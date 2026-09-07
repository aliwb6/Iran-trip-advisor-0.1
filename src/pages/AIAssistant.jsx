// @ts-nocheck
import { useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '@/lib/i18n.jsx';
import { supabase } from '@/supabaseClient';
import { selectPublicProfiles } from '@/lib/publicProfiles';
import { selectPublicTours } from '@/lib/publicTours';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Send, MapPin, Clock, Users, Wallet,
  Building2, Mountain, UtensilsCrossed,
  Leaf, Compass, Loader2, ArrowLeft, ArrowRight, DollarSign,
  Trash2, Plus, MessageSquare, Menu, X,
  Copy, Check, Paperclip, FileText,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { sendChatMessage } from '../services/api.js';
import { toast } from 'sonner';
import { avatarFor } from '@/lib/avatar';
import TripBuilder from '@/components/ai/TripBuilder';
import { useChatHistory } from '@/hooks/useChatHistory';
import { ChatMessage } from '@/components/chat/ChatMessage';
import TripRequestForm from '@/components/profile/TripRequestForm';
import { extractTripDraft, mapDraftToForm } from '@/utils/tripDraft';

// ── Brand tokens ──────────────────────────────────────────────────────────────
const C = {
  turq:     '#0D8B85',
  turqSoft: '#3FC7C1',
  turqDeep: '#0A6864',
  teal:     '#1A4A4A',
  white:    '#FFFFFF',
  mist:     '#F5FBFA',
  muted:    '#7A8C8C',
  ink:      '#0F2A2A',
  gold:     '#C9972B',
};

// ── Persian Rub-el-Hizb pattern ───────────────────────────────────────────────
function PersianPattern({ opacity = 0.06, color = C.turq, size = 72 }) {
  return (
    <svg
      className="absolute inset-0 h-full w-full select-none pointer-events-none"
      aria-hidden="true"
      style={{ opacity }}
    >
      <defs>
        <pattern id="rub-el-hizb" width={size} height={size} patternUnits="userSpaceOnUse">
          <g fill="none" stroke={color} strokeWidth="0.9">
            <rect x={size * 0.22} y={size * 0.22} width={size * 0.56} height={size * 0.56} />
            <rect
              x={size * 0.22} y={size * 0.22}
              width={size * 0.56} height={size * 0.56}
              transform={`rotate(45 ${size / 2} ${size / 2})`}
            />
            <circle cx={size / 2} cy={size / 2} r="1.6" fill={color} />
          </g>
          <g fill={color}>
            <circle cx="0" cy="0" r="1" /><circle cx={size} cy="0" r="1" />
            <circle cx="0" cy={size} r="1" /><circle cx={size} cy={size} r="1" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#rub-el-hizb)" />
    </svg>
  );
}

// ── Aria avatar mark ──────────────────────────────────────────────────────────
function AriaMark({ size = 36, pulse = false }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 28%, ${C.turqSoft}, ${C.turq} 60%, ${C.turqDeep})`,
          boxShadow: `0 4px 12px ${C.turq}40, inset 0 0 0 1px ${C.turqDeep}80`,
        }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <Sparkles className="text-white" style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} />
      </div>
      {pulse && (
        <span className="absolute -inset-1 rounded-full animate-ping" style={{ background: `${C.turq}25` }} aria-hidden />
      )}
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5 rounded-full"
          style={{ background: C.muted }}
          animate={{ y: [0, -4, 0], opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// Locked to "Auto (Best Available)" — user cannot change the model.
const AUTO_MODEL         = 'openrouter/auto';
const FREE_FALLBACK_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

// MessageBubble is now the ChatMessage component from src/components/chat/ChatMessage.jsx.
// Card rendering for assistant messages is handled inline in the message list below.

// ── Profile chip ──────────────────────────────────────────────────────────────
function ProfileChip({ icon: Icon, label, value, filled, accent }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-2xl p-4 transition-all"
      style={{
        background: filled ? C.white : `${C.muted}08`,
        border: `1px solid ${filled ? C.muted + '25' : C.muted + '15'}`,
        boxShadow: filled ? `0 4px 14px ${C.teal}08` : 'none',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{ background: filled ? `${accent}15` : `${C.muted}10`, color: filled ? accent : C.muted }}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: C.muted }}>
            {label}
          </div>
          <div className="mt-0.5 truncate text-[14px] font-semibold" style={{ color: filled ? C.teal : `${C.muted}80` }}>
            {value || 'Listening…'}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ eyebrow, title, trailing }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.turq }}>
          {eyebrow}
        </div>
        <h3 className="mt-1 text-[18px] font-bold leading-tight" style={{ color: C.teal }}>
          {title}
        </h3>
      </div>
      {trailing}
    </div>
  );
}

// ── Suggested replies ─────────────────────────────────────────────────────────
// ── Conversation history sidebar ──────────────────────────────────────────────
function ConversationSidebar({ conversations, activeId, onNew, onSwitch, onDelete, lang, dir, open, onClose, isLoadingConvs, isLoggedIn }) {
  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      const locale = lang === 'fa' ? 'fa-IR' : lang === 'ar' ? 'ar-SA' : 'en-US';
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
      if (diffDays < 7) return date.toLocaleDateString(locale, { weekday: 'short' });
      return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const slideHidden = dir === 'rtl' ? 'translate-x-full' : '-translate-x-full';
  const fixedSide = dir === 'rtl' ? 'right-0' : 'left-0';

  return (
    <>
      {/* Mobile backdrop — above header (z-[55]) so the drawer covers it fully */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-[55] lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar — z-[60] so it renders above both the backdrop and the header */}
      <aside
        className={[
          'flex flex-col w-64 shrink-0 z-[60]',
          'fixed inset-y-0 lg:static lg:inset-auto',
          fixedSide,
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : `${slideHidden} lg:translate-x-0`,
        ].join(' ')}
        style={{
          background: C.mist,
          borderInlineEnd: `1px solid ${C.muted}20`,
          height: '100%',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${C.muted}15` }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: C.muted }}>
            {lang === 'fa' ? 'گفتگوها' : lang === 'ar' ? 'المحادثات' : 'Conversations'}
          </span>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="lg:hidden h-7 w-7 flex items-center justify-center rounded-lg transition-colors hover:bg-black/10"
            style={{ color: C.muted }}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* New Chat button */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <button
            onClick={() => { onNew(); onClose(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all hover:opacity-90 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${C.turq}, ${C.turqDeep})`,
              color: C.white,
              boxShadow: `0 4px 14px ${C.turq}35`,
            }}
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span>{lang === 'fa' ? 'گفتگوی جدید' : lang === 'ar' ? 'محادثة جديدة' : 'New Chat'}</span>
          </button>
        </div>

        {/* Guest notice */}
        {!isLoggedIn && (
          <div
            className="mx-3 mb-2 px-3 py-2.5 rounded-xl text-[11px] leading-snug"
            style={{ background: `${C.turq}12`, color: C.turq, border: `1px solid ${C.turq}25` }}
          >
            {lang === 'fa'
              ? 'برای ذخیره گفتگوها وارد شوید'
              : lang === 'ar'
              ? 'سجّل دخولك لحفظ محادثاتك'
              : 'Login to save your conversations'}
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {isLoadingConvs ? (
            <div className="space-y-1.5 px-1 pt-1">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex flex-col gap-1.5 px-3 py-2.5 rounded-xl" style={{ background: `${C.muted}08` }}>
                  <div className="h-3 rounded-full animate-pulse" style={{ background: `${C.muted}25`, width: `${60 + n * 10}%` }} />
                  <div className="h-2 rounded-full animate-pulse" style={{ background: `${C.muted}15`, width: '40%' }} />
                </div>
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <MessageSquare className="h-8 w-8 mb-3" style={{ color: `${C.muted}60` }} />
              <p className="text-xs" style={{ color: C.muted }}>
                {lang === 'fa' ? 'هنوز گفتگویی ندارید' : lang === 'ar' ? 'لا توجد محادثات بعد' : 'No conversations yet'}
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === activeId;
              return (
                <div
                  key={conv.id}
                  className="group flex items-start gap-2 w-full px-3 py-2.5 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: isActive ? C.white : 'transparent',
                    boxShadow: isActive ? `0 2px 8px ${C.teal}10` : 'none',
                  }}
                  onClick={() => { onSwitch(conv.id); onClose(); }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = `${C.white}80`; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p
                      className="text-[12.5px] font-medium leading-snug line-clamp-2"
                      style={{ color: isActive ? C.turq : C.teal }}
                    >
                      {conv.title || (lang === 'fa' ? 'گفتگوی جدید' : lang === 'ar' ? 'محادثة جديدة' : 'New conversation')}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: C.muted }}>
                      {formatTime(conv.timestamp)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5 h-6 w-6 flex items-center justify-center rounded-lg hover:bg-red-50"
                    style={{ color: '#ef4444' }}
                    title={lang === 'fa' ? 'حذف' : lang === 'ar' ? 'حذف' : 'Delete'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
}

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(tours, guides, responseLang = 'English') {
  const toursList = tours.length
    ? tours.map((t) => {
        const cities = Array.isArray(t.cities) ? t.cities.join(', ') : (t.cities || '');
        return `- slug: ${t.slug || t.id}, title: ${t.title || ''}, cities: ${t.city || cities || t.location || ''}, duration: ${t.duration ?? '?'} days, price: ${t.price != null ? `$${t.price}` : '—'}`;
      }).join('\n')
    : '(no published tours available right now)';

  const guidesList = guides.length
    ? guides.map((g) => `- id: ${g.id}, name: ${g.full_name || ''}, city: ${g.city || ''}`)
        .join('\n')
    : '(no guides available right now)';

  return `You are Aria, a warm and deeply knowledgeable travel companion for Iran Trip Advisor. You are FIRST a cultural guide and storyteller — an expert on Iran's history, architecture, cities, art, food, nature, customs, and practical travel — and only SECOND someone who can suggest a tour or a local guide. You are a real advisor, never a brochure.

CRITICAL LANGUAGE RULE: You MUST reply in ${responseLang} only. Never switch languages under any circumstances.

HOW TO TALK:
- ALWAYS answer the traveller's actual question first, with real, specific, accurate information. If they say they love historical buildings, tell them about real places — Persepolis, Naqsh-e Jahan Square with its Ali Qapu palace, Chehel Sotoun, the Sheikh Lotfollah and Shah mosques of Isfahan, the adobe old city of Yazd and its windcatchers, the bazaar of Tabriz — with vivid detail and cultural context. Teach, describe, tell the story.
- Be genuinely helpful on any travel topic: best seasons, regions and routes, visas, etiquette and customs, food to try, useful Persian phrases, safety, money.
- Write naturally and conversationally. A good answer is usually a short paragraph or two — do not pad, but never cut yourself down to a single dismissive sentence. Use at most 1 emoji.
- Do NOT recommend a tour or guide in your first reply to a new interest. First be useful, then ask one or two natural follow-up questions to understand what the traveller truly wants (interests, when, who is travelling, pace, budget). Let the conversation breathe.

WHEN (AND ONLY WHEN) TO RECOMMEND:
- Only after you have genuinely helped AND the conversation makes a specific tour or guide a natural, well-matched next step may you suggest ONE tour OR one guide — never both, never multiples, never as a reflex.
- If nothing is a strong match, do not force a recommendation — just keep being a helpful guide, and do NOT append any block.
- IMPORTANT: The MOMENT you name a specific tour or guide from the lists below as a suggestion, you MUST end that message with the JSON block — EVEN IF you also ask a follow-up question in the same message. Naming a tour or guide in your text without attaching the block is not allowed, because the block is what renders the clickable card the traveller can open.
- Append the block at the very END of the message, with no text after it, in exactly this format:
\`\`\`json
{"tour_slugs": ["exact-slug"], "guide_ids": []}
\`\`\`
Use the exact slug (for a tour) or id (for a guide) from the lists below — put it in the matching array and leave the other array empty. Never include more than one item in total.
- Do NOT append the block on turns where you are only teaching, describing, or asking questions WITHOUT naming any specific tour or guide.

AVAILABLE TOURS:
${toursList}

LOCAL GUIDES:
${guidesList}

CUSTOM TRIP (when nothing in the catalogue fits):
- If, after genuinely trying, no tour and no guide above is a good match — OR the traveller explicitly wants a fully custom/tailor-made trip — warmly offer a custom trip request, explaining that local guides will send them personal proposals to choose from.
- BEFORE offering, make sure through natural conversation you have learned ALL of: destination city in Iran, approximate start and end dates, number of adults and children, which language(s) they want their guide to speak, their budget level, the kind of holiday they want, any extra services (flights / train / attraction tickets / visa / airport transfer), whether they prefer a private or group trip, and a short free-text of their goals/interests. Ask for whatever is still missing, one question at a time. Never show this as a checklist.
- Only AFTER the traveller confirms they want the custom trip, write your normal friendly confirmation sentence, then on its own lines append EXACTLY one block in this format (and nothing after it):
[[TRIP_DRAFT]]
{"destination":"city or region name", "start_date":"YYYY-MM-DD", "end_date":"YYYY-MM-DD", "arrival_time":"HH:MM AM/PM", "departure_time":"HH:MM AM/PM", "timings_flexible":false, "adults":1, "children":0, "guide_languages":[], "assistance":[], "accommodation_stars":null, "requirements":"", "holiday_types":[], "additional_services":[], "tour_type":""}
[[/TRIP_DRAFT]]
- Field rules for the block:
  - guide_languages: subset of English, Persian, Arabic, French, German, Chinese, Spanish.
  - assistance: subset of Transportation, Accommodation.
  - accommodation_stars: 1=Budget, 2=Economy, 3=Standard, 4=Premium, 5=Luxury (or null if unknown).
  - holiday_types: subset of Active, Local Living, Nature, Offbeat, Relaxing.
  - additional_services: subset of Air Tickets, Train Tickets, Attraction Tickets, Visa, Airport Transfer.
  - tour_type: "private" or "group" (or "").
  - requirements: one or two sentences summarising interests, goals, and special needs.
- Do NOT output the [[TRIP_DRAFT]] block in the same message as the tour_slugs/guide_ids recommendation block. The draft block is ONLY for the custom-trip path, after explicit confirmation. Fill every field as best you can; use the defaults shown for anything unknown.`;
}

// ── Trip planning questions ───────────────────────────────────────────────────
const TRIP_QUESTIONS = [
  { id: 'destinations',   text: "Which cities or regions in Iran interest you? 🗺️" },
  { id: 'start_date',     text: "When would you like to start your trip? (e.g. June 15 or 2025-06-15)" },
  { id: 'end_date',       text: "And when would you like to return?" },
  { id: 'adults',         text: "How many adults will be traveling?" },
  { id: 'children',       text: "Will any children be joining? If so, how many? (say 0 if none)" },
  { id: 'tour_type',      text: "Do you prefer a private tour or a group tour?" },
  { id: 'holiday_type',   text: "What kind of experience? (Active / Nature / Culture / Relaxing / Local Living)" },
  { id: 'budget',         text: "What's your approximate budget per person in USD?" },
  { id: 'accommodation',  text: "Will you need help with accommodation? (yes / no)" },
  { id: 'transport',      text: "Will you need help with local transportation? (yes / no)" },
];

async function extractTripDataFromAnswers(tripAnswers) {
  const answersText = TRIP_QUESTIONS.map(q => `${q.id}: ${tripAnswers[q.id] || ''}`).join('\n');
  const prompt = `Extract trip planning data from these Q&A answers and return ONLY valid JSON with no markdown fences or explanation:
${answersText}

Return exactly this JSON structure (fill in values from the answers, use sensible defaults):
{"destinations_array":["city1"],"start_date":"YYYY-MM-DD","end_date":"YYYY-MM-DD","adults":1,"children":0,"tour_type":"private","holiday_types":["nature"],"needs_accommodation":true,"needs_transport":false,"notes":""}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const cleaned = raw.replace(/```(?:json)?|```/g, '').trim();
  return JSON.parse(cleaned);
}

// ── Recommendation parsing ────────────────────────────────────────────────────
const JSON_FENCE = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;

function extractRecommendation(raw, tours, guides) {
  if (!raw) return { content: '', tours: [], guides: [] };
  const match = raw.match(JSON_FENCE);
  if (!match) return { content: raw, tours: [], guides: [] };
  try {
    const json = JSON.parse(match[1]);
    const slugs = Array.isArray(json.tour_slugs) ? json.tour_slugs : [];
    const ids = Array.isArray(json.guide_ids) ? json.guide_ids : [];
    const recTours = slugs
      .map((s) => tours.find((tr) => tr.slug === s || String(tr.id) === String(s)))
      .filter(Boolean);
    const recGuides = ids
      .map((id) => guides.find((g) => String(g.id) === String(id)))
      .filter(Boolean);
    return { content: raw.replace(JSON_FENCE, '').trim(), tours: recTours, guides: recGuides };
  } catch {
    return { content: raw, tours: [], guides: [] };
  }
}

// ── Build greeting for a new conversation ─────────────────────────────────────
function buildGreeting(cityHint, lang) {
  if (cityHint) {
    if (lang === 'fa') return `سلام! دیدم به ${cityHint} علاقه داری — عالیه! چه چیزی تو را به این شهر می‌کشاند؟`;
    if (lang === 'ar') return `مرحباً! أرى أنك مهتم بـ ${cityHint} — اختيار رائع! ما الذي يجذبك إلى هذه المدينة؟`;
    return `Salaam! I see you're curious about ${cityHint} — great choice. What's drawing you there?`;
  }
  if (lang === 'fa') return 'سلام! من راهنمای سفر هوشمند ایران تور ادوایزر هستم. بگو ببینم، چه چیزی تو را به ایران می‌کشاند؟';
  if (lang === 'ar') return 'مرحباً! أنا مستشار سفرك إلى إيران من Iran Trip Advisor. أخبرني، ما الذي يجذبك إلى إيران؟';
  return "Salaam! I'm your Iran travel advisor at Iran Trip Advisor. Tell me — what's drawing you to Iran?";
}

// ── Shared recommendations panel content (desktop sidebar + mobile sheet) ─────
function RecommendationsPanelContent({ lang, profile, sidebarTours, sidebarGuides, hasRecommendations }) {
  return (
    <div>
      {/* Profile chips */}
      <div className="px-6 pt-6 pb-6">
        <SectionHeading
          eyebrow={lang === 'fa' ? 'حین گفتگو' : lang === 'ar' ? 'أثناء المحادثة' : 'As we talk'}
          title={lang === 'fa' ? 'پروفایل سفر شما' : lang === 'ar' ? 'ملفك السياحي' : 'Your Travel Profile'}
          trailing={
            <span className="text-[11px] font-medium" style={{ color: C.muted }}>
              {Object.values(profile).filter((v) => typeof v === 'string' && v).length}/4
            </span>
          }
        />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <ProfileChip icon={Building2} label={lang === 'fa' ? 'هدف سفر' : lang === 'ar' ? 'هدف الرحلة' : 'Travel Goal'}   value={profile.goal}     filled={!!profile.goal}     accent={C.turq} />
          <ProfileChip icon={Clock}     label={lang === 'fa' ? 'مدت سفر'  : lang === 'ar' ? 'المدة'          : 'Duration'}     value={profile.duration} filled={!!profile.duration} accent={C.teal} />
          <ProfileChip icon={Users}     label={lang === 'fa' ? 'نوع گروه' : lang === 'ar' ? 'نوع المجموعة'  : 'Group Type'}   value={profile.group}    filled={!!profile.group}    accent={C.muted} />
          <ProfileChip icon={Wallet}    label={lang === 'fa' ? 'بودجه'    : lang === 'ar' ? 'الميزانية'     : 'Budget Level'} value={profile.budget}   filled={!!profile.budget}   accent={C.turq} />
        </div>
      </div>

      {/* Divider */}
      <div
        className="mx-6 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${C.muted}40, transparent)` }}
      />

      {/* Recommendations */}
      <AnimatePresence>
        {hasRecommendations && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="px-6 py-6"
          >
            <SectionHeading
              eyebrow="Curated by Aria"
              title={lang === 'fa' ? 'پیشنهادات برای شما' : lang === 'ar' ? 'موصى به لك' : 'Recommended for You'}
            />
            {sidebarTours.length > 0 && (
              <div className="mt-5 grid grid-cols-1 gap-3">
                {sidebarTours.map((tour) => <TourCard key={tour.id} tour={tour} />)}
              </div>
            )}
            {sidebarGuides.length > 0 && (
              <div className="mt-7">
                <SectionHeading
                  eyebrow={lang === 'fa' ? 'راهنمایان محلی' : lang === 'ar' ? 'مرشدون محليون' : 'Local hosts'}
                  title={lang === 'fa' ? 'راهنمایانی که منتظر دیدارتان هستند' : lang === 'ar' ? 'مرشدون يودّون مقابلتك' : "Guides who'd love to meet you"}
                />
                <div className="mt-4 flex flex-col gap-2.5">
                  {sidebarGuides.map((guide) => <GuideCard key={guide.id} guide={guide} />)}
                </div>
              </div>
            )}
            <Link
              to="/tours"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[13.5px] font-semibold transition-all hover:opacity-90"
              style={{ background: C.teal, color: C.white, boxShadow: `0 8px 22px ${C.teal}30` }}
            >
              <Compass className="h-4 w-4" />
              {lang === 'fa' ? 'ساخت برنامه سفر اختصاصی' : lang === 'ar' ? 'إنشاء خط سير مخصص' : 'Build a custom itinerary'}
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AIAssistant() {
  const { t, dir, lang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const scrollerRef = useRef(null);
  const inputRef = useRef(null);
  const initDone = useRef(false);
  const [searchParams] = useSearchParams();
  const cityHint = searchParams.get('city') || '';
  const initialMessage = location.state?.initialMessage || '';

  const {
    conversations,
    activeId,
    messages,
    isLoggedIn,
    isLoadingConvs,
    isLoadingMsgs,
    createConversation,
    persistConversation,
    appendMessage,
    editMessage,
    deleteConversation,
    switchConversation,
  } = useChatHistory();

  // Calls the API with automatic fallback to the free model on 404 / 402.
  // Model is always "Auto (Best Available)" — no user-facing picker.
  const callWithFallback = async (msgs, sysprompt, model = AUTO_MODEL) => {
    try {
      return await sendChatMessage(msgs, sysprompt, lang, model);
    } catch (err) {
      if (err.status === 401) {
        toast.error(
          lang === 'fa' ? 'کلید API نامعتبر یا منقضی است'
          : lang === 'ar' ? 'مفتاح API غير صالح أو منتهي الصلاحية'
          : 'API key invalid or expired'
        );
        throw err;
      }
      if (err.status === 404 || err.status === 402) {
        const reason = err.status === 404 ? 'Model not available' : 'No credits';
        toast.warning(
          lang === 'fa' ? `${reason} — درحال تغییر به مدل رایگان`
          : lang === 'ar' ? `${reason} — يتم التبديل إلى النموذج المجاني`
          : `${reason} — switching to free model`
        );
        return await sendChatMessage(msgs, sysprompt, lang, FREE_FALLBACK_MODEL);
      }
      throw err;
    }
  };

  const [input, setInput] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const [catalogue, setCatalogue] = useState({ tours: [], guides: [], ready: false });
  const [profile] = useState({ goal: '', duration: '', group: '', budget: '', vibes: [] });
  const [showTripBuilder, setShowTripBuilder] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [recsSheetOpen, setRecsSheetOpen] = useState(false);
  const [rejectionCount, setRejectionCount]     = useState(0);
  const [tripPlanningMode, setTripPlanningMode] = useState(false);
  const [currentQuestion, setCurrentQuestion]  = useState(0);
  const [tripAnswers, setTripAnswers]           = useState({});
  const [tripFormOpen, setTripFormOpen]         = useState(false);
  const [tripFormData, setTripFormData]         = useState(null);
  const [draftForModal, setDraftForModal]       = useState(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [copiedId, setCopiedId]                 = useState(null);
  const [attachedFile, setAttachedFile]         = useState(null);
  const fileInputRef = useRef(null);

  // Create a new conversation on every page visit (mount)
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    const greeting = buildGreeting(cityHint, lang);
    createConversation(greeting, lang);
    if (cityHint && !initialMessage) {
      setInput(
        lang === 'fa'
          ? `می‌خواهم سفری به ${cityHint} برنامه‌ریزی کنم.`
          : lang === 'ar'
          ? `أرغب في التخطيط لرحلة إلى ${cityHint}.`
          : `I'd like to plan a trip to ${cityHint}.`
      );
    }
  }, []); // intentionally empty — runs once on mount

  // Fetch tours + guides once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [toursRes, guidesRes] = await Promise.all([
        selectPublicTours(supabase),
        selectPublicProfiles(supabase).in('role', ['guide', 'agency']),
      ]);
      if (cancelled) return;
      setCatalogue({ tours: toursRes.data || [], guides: guidesRes.data || [], ready: true });
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const resetTripPlanning = () => {
    setTripPlanningMode(false);
    setCurrentQuestion(0);
    setTripAnswers({});
    setRejectionCount(0);
  };

  const handleNewChat = () => {
    const greeting = buildGreeting(cityHint, lang);
    createConversation(greeting, lang);
    setInput('');
    setSidebarOpen(false);
    resetTripPlanning();
  };

  // Called by ChatMessage when user saves an edit.
  // Truncates the conversation at that message, then re-sends to the API.
  const handleEditAndResend = async (convId, msgId, newText) => {
    if (loading) return;

    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx === -1) return;

    const messagesForApi = [
      ...messages.slice(0, idx).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: newText },
    ];

    // Truncate state + mark as edited
    editMessage(convId, msgId, newText);
    setLoading(true);

    try {
      const systemPromptText = buildSystemPrompt(catalogue.tours, catalogue.guides);
      const responseText = await callWithFallback(messagesForApi, systemPromptText);
      const { content: afterDraft, draft } = extractTripDraft(responseText);
      if (draft) {
        const mapped = mapDraftToForm(draft);
        appendMessage(convId, { role: 'assistant', content: afterDraft, tripDraft: mapped });
      } else {
        const { content, tours, guides } = extractRecommendation(afterDraft, catalogue.tours, catalogue.guides);
        const assistantMsg = { role: 'assistant', content };
        if (tours.length > 0 || guides.length > 0) assistantMsg.cards = { tours, guides };
        appendMessage(convId, assistantMsg);
      }
    } catch (err) {
      const friendly = lang === 'fa'
        ? `متأسفم، مشکلی پیش آمد. (${err.message})`
        : lang === 'ar'
        ? `عذراً، حدث خطأ. (${err.message})`
        : `Sorry — couldn't reach the assistant. (${err.message})`;
      appendMessage(convId, { role: 'assistant', content: friendly });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const detectLanguage = (text) => {
    const persianSpecific = /[کگھیپچژ]/;
    if (persianSpecific.test(text)) return 'Persian/Farsi';
    const arabicScript = /[؀-ۿ]/;
    if (arabicScript.test(text)) return 'Arabic';
    return 'English';
  };

  const sendMessage = async (textArg) => {
    const text = (textArg !== undefined ? textArg : input).trim();
    if ((!text && !attachedFile) || loading) return;
    const lc = text.toLowerCase();
    const responseLang = detectLanguage(text);

    // ── Helper: resolve conversation id ────────────────────────────────────────
    const resolveConvId = async (title) => {
      let id = activeId;
      if (!id && !isLoggedIn) id = createConversation(null, lang);
      if (isLoggedIn && (!id || !conversations.some((c) => c.id === id))) {
        id = await persistConversation(title || text.slice(0, 40));
      }
      return id;
    };

    // ── Trip planning mode: collect answers one at a time ──────────────────────
    if (tripPlanningMode) {
      const qId = TRIP_QUESTIONS[currentQuestion]?.id;
      const updatedAnswers = { ...tripAnswers, [qId]: text };
      setTripAnswers(updatedAnswers);
      setInput('');

      const convId = await resolveConvId('Trip Planning');
      if (!convId) return;
      appendMessage(convId, { role: 'user', content: text });

      const nextQ = currentQuestion + 1;
      if (nextQ < TRIP_QUESTIONS.length) {
        setCurrentQuestion(nextQ);
        appendMessage(convId, { role: 'assistant', content: TRIP_QUESTIONS[nextQ].text });
      } else {
        // All questions answered — extract and open form
        setLoading(true);
        appendMessage(convId, { role: 'assistant', content: 'Perfect! Let me put that together for you... ✨' });
        try {
          const extracted = await extractTripDataFromAnswers(updatedAnswers);
          setTripFormData(extracted);
          setTripFormOpen(true);
        } catch {
          appendMessage(convId, { role: 'assistant', content: "Something went wrong building your trip details. Please try again." });
        } finally {
          setLoading(false);
          resetTripPlanning();
          inputRef.current?.focus();
        }
      }
      return;
    }

    // ── Rejection keyword tracking ─────────────────────────────────────────────
    const rejectionKeywords = ['no thank', 'not interested', "don't want", 'not for me', 'skip', 'never mind', 'pass', 'nope', 'not really'];
    const farsiRejections   = ['نه', 'نمی‌خوام', 'علاقه ندارم', 'نه ممنون'];
    const arabicRejections  = ['لا', 'لا أريد', 'لا شكرا'];
    const isRejection = rejectionKeywords.some(k => lc.includes(k)) ||
      (lang === 'fa' && farsiRejections.some(k => text.includes(k))) ||
      (lang === 'ar' && arabicRejections.some(k => text.includes(k)));

    if (isRejection) {
      const newCount = rejectionCount + 1;
      setRejectionCount(newCount);
      if (newCount >= 2) {
        setTripPlanningMode(true);
        setCurrentQuestion(0);
        setTripAnswers({});
        setInput('');
        const convId = await resolveConvId('Trip Planning');
        if (!convId) return;
        appendMessage(convId, { role: 'user', content: text });
        appendMessage(convId, { role: 'assistant', content: `Let me build something just for you! 🎯 First question:\n\n${TRIP_QUESTIONS[0].text}` });
        return;
      }
    }

    // ── Trip builder shortcut ──────────────────────────────────────────────────
    const tripKeywords  = ['custom trip', 'create trip', 'plan trip', 'custom itinerary', 'build trip'];
    const farsiKeywords = ['سفر سفارشی', 'سفر شخصی', 'برنامه‌ریزی سفر', 'ایجاد برنامه'];
    const arabicKeywords = ['رحلة مخصصة', 'خطة رحلة', 'خطة سفر'];
    if (tripKeywords.some((kw) => lc.includes(kw)) ||
        (lang === 'fa' && farsiKeywords.some((kw) => text.includes(kw))) ||
        (lang === 'ar' && arabicKeywords.some((kw) => text.includes(kw)))) {
      setShowTripBuilder(true);
      return;
    }

    if (!import.meta.env.VITE_OPENROUTER_API_KEY) {
      const missing = lang === 'fa'
        ? 'کلید API موجود نیست. لطفاً فایل .env را بررسی کنید.'
        : lang === 'ar'
        ? 'مفتاح API مفقود. يرجى التحقق من ملف .env.'
        : 'API key is missing. Please check your .env file.';
      const errId = activeId || createConversation(null, lang);
      appendMessage(errId, { role: 'assistant', content: missing });
      return;
    }

    // ── Normal chat ────────────────────────────────────────────────────────────
    const convId = await resolveConvId();
    if (!convId) return;

    const currentFile = attachedFile;
    setAttachedFile(null);

    const userMsg = {
      role: 'user',
      content: text || (currentFile ? `[Sent a ${currentFile.type === 'image' ? 'photo' : 'file'}: ${currentFile.name}]` : ''),
      image: currentFile?.type === 'image' ? currentFile.preview : null,
      fileName: currentFile?.type === 'file' ? currentFile.name : null,
    };

    const messagesForApi = [
      ...messages,
      {
        role: 'user',
        content: currentFile
          ? [
              ...(currentFile.type === 'image'
                ? [{ type: 'image_url', image_url: { url: `data:${currentFile.mimeType};base64,${currentFile.base64}` } }]
                : [{ type: 'text', text: `[The user has uploaded a file named "${currentFile.name}". Since you cannot read this file directly, acknowledge it and ask them to describe the content or copy-paste the relevant text so you can help them plan their Iran trip based on it.]` }]
              ),
              { type: 'text', text: `[Respond in ${responseLang}]\n${text || 'Please analyze this and help me plan an Iran trip.'}` },
            ]
          : `[Respond in ${responseLang}]\n${text}`,
      },
    ];

    appendMessage(convId, userMsg);
    setInput('');
    setLoading(true);

    try {
      const systemPromptText = buildSystemPrompt(catalogue.tours, catalogue.guides, responseLang);
      const visionModel = currentFile?.type === 'image' ? 'openai/gpt-4o-mini' : AUTO_MODEL;
      const responseText = await callWithFallback(messagesForApi, systemPromptText, visionModel);
      const { content: afterDraft, draft } = extractTripDraft(responseText);
      if (draft) {
        const mapped = mapDraftToForm(draft);
        appendMessage(convId, { role: 'assistant', content: afterDraft, tripDraft: mapped });
      } else {
        const { content, tours, guides } = extractRecommendation(afterDraft, catalogue.tours, catalogue.guides);
        const assistantMsg = { role: 'assistant', content };
        if (tours.length > 0 || guides.length > 0) assistantMsg.cards = { tours, guides };
        appendMessage(convId, assistantMsg);
      }
    } catch (err) {
      const friendly = lang === 'fa'
        ? `متأسفم، در ارتباط با دستیار مشکلی پیش آمد. (${err.message})`
        : lang === 'ar'
        ? `عذراً، تعذر الاتصال بالمساعد. (${err.message})`
        : `Sorry — I couldn't reach the assistant. (${err.message})`;
      appendMessage(convId, { role: 'assistant', content: friendly });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isDoc = file.type === 'application/pdf' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/msword' ||
      file.type === 'text/plain';

    if (!isImage && !isDoc) {
      alert('Please upload an image, PDF, Word document, or text file.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(',')[1];
      setAttachedFile({
        type: isImage ? 'image' : 'file',
        base64,
        name: file.name,
        mimeType: file.type,
        preview: isImage ? ev.target.result : null,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  // Sidebar recommendation data
  const sidebarTours = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].cards?.tours?.length > 0) return messages[i].cards.tours.slice(0, 4);
    }
    return catalogue.tours.slice(0, 4);
  }, [messages, catalogue.tours]);

  const sidebarGuides = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].cards?.guides?.length > 0) return messages[i].cards.guides.slice(0, 3);
    }
    return catalogue.guides.slice(0, 3);
  }, [messages, catalogue.guides]);

  const hasRecommendations = catalogue.ready && (sidebarTours.length > 0 || sidebarGuides.length > 0);

  return (
    <div
      dir={dir}
      className="flex min-h-screen lg:h-screen w-full lg:overflow-hidden"
      style={{ background: C.white, color: C.ink }}
    >
      {/* ── Conversation History Sidebar ────────────────────────────────── */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onNew={handleNewChat}
        onSwitch={switchConversation}
        onDelete={deleteConversation}
        lang={lang}
        dir={dir}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isLoadingConvs={isLoadingConvs}
        isLoggedIn={isLoggedIn}
      />

      {/* ── Main area (Chat + Recommendations) ────────────────────────── */}
      <div className="flex flex-1 min-w-0 flex-col lg:flex-row lg:h-full">

        {/* ── Chat column ──────────────────────────────────────────────── */}
        <section
          className="relative flex flex-col flex-1 min-w-0 lg:border-r lg:h-full"
          style={{ borderColor: `${C.muted}20` }}
        >
          {/* Header */}
          <header className="relative overflow-visible px-4 pt-5 pb-4 sm:px-8 sm:pt-9 sm:pb-7 shrink-0 z-50">
            <PersianPattern opacity={0.055} color={C.turq} size={64} />
            <div
              className="absolute inset-x-0 top-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${C.turq}55, transparent)` }}
            />

            {/* Single-row layout — truncates title on small screens, no overflow */}
            <div className="relative flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                {/* Sidebar toggle — all screen sizes */}
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors shrink-0"
                  style={{ background: `${C.muted}10`, color: C.teal }}
                  aria-label="Open conversation history"
                >
                  <Menu className="h-4 w-4" />
                </button>

                {/* Back button — desktop only */}
                <button
                  onClick={() => navigate(-1)}
                  className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl transition-colors shrink-0"
                  style={{ background: `${C.muted}10`, color: C.teal }}
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>

                <AriaMark size={40} pulse />

                <div className="min-w-0 flex-1">
                  <div
                    className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: C.turq }}
                  >
                    Iran Trip Advisor
                  </div>
                  <h1
                    className="text-[15px] sm:text-[20px] lg:text-[22px] font-bold leading-tight truncate"
                    style={{ color: C.teal, letterSpacing: '-0.01em' }}
                  >
                    {t('ai_title')}
                  </h1>
                </div>
              </div>

            </div>

            {/* Carpet hairline */}
            <div
              className="mt-4 sm:mt-5 h-[2px] w-full"
              style={{
                background: `repeating-linear-gradient(90deg, ${C.turq} 0 6px, transparent 6px 12px, ${C.muted} 12px 14px, transparent 14px 20px)`,
                opacity: 0.45,
              }}
            />
          </header>

          {/* Messages */}
          <div
            ref={scrollerRef}
            className="flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-8"
          >
            {isLoadingMsgs ? (
              <div className="flex items-center justify-center h-40 gap-3" style={{ color: C.muted }}>
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: C.turq }} />
                <span className="text-sm">
                  {lang === 'fa' ? 'در حال بارگذاری…' : lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}
                </span>
              </div>
            ) : null}
            <div className="mx-auto flex max-w-[680px] flex-col gap-5">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => {
                  const key = msg.id || i;
                  const cards = msg.role === 'assistant' && msg.cards
                    ? (
                      <div className="space-y-3">
                        {msg.cards.tours?.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {msg.cards.tours.map((tour) => <TourCard key={tour.id} tour={tour} />)}
                          </div>
                        )}
                        {msg.cards.guides?.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {msg.cards.guides.map((guide) => <GuideCard key={guide.id} guide={guide} />)}
                          </div>
                        )}
                      </div>
                    )
                    : null;
                  return (
                    <div key={key} className="group relative">
                      {msg.role === 'user' && msg.image && (
                        <div className="flex justify-end mb-1">
                          <img decoding="async" loading="lazy" src={msg.image} alt="uploaded" className="max-w-xs rounded-xl max-h-48 object-cover" />
                        </div>
                      )}
                      {msg.role === 'user' && msg.fileName && (
                        <div className="flex justify-end mb-1">
                          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: `${C.turq}20` }}>
                            <FileText className="w-4 h-4 shrink-0" style={{ color: C.teal }} />
                            <span className="text-xs truncate max-w-[180px]" style={{ color: C.teal }}>{msg.fileName}</span>
                          </div>
                        </div>
                      )}
                      <ChatMessage
                        msg={msg}
                        convId={activeId}
                        onEdit={handleEditAndResend}
                        loading={loading}
                        lang={lang}
                        renderCards={cards}
                      />
                      {msg.role === 'assistant' && msg.tripDraft && (
                        <div className="mt-3 ms-10">
                          <button
                            onClick={() => { setDraftForModal(msg.tripDraft); setRequestModalOpen(true); }}
                            className="inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all hover:opacity-90 hover:-translate-y-0.5 active:scale-95"
                            style={{
                              background: `linear-gradient(135deg, ${C.turq}, ${C.turqDeep})`,
                              color: C.white,
                              boxShadow: `0 6px 18px ${C.turq}30`,
                            }}
                          >
                            <Sparkles className="h-4 w-4 shrink-0" />
                            {t('ai_trip_draft_cta')}
                          </button>
                        </div>
                      )}
                      <button
                        onClick={() => copyToClipboard(msg.content, i)}
                        className={`absolute opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center ${
                          msg.role === 'user' ? 'bottom-1 left-0' : 'bottom-1 right-0'
                        }`}
                        style={{ background: `${C.muted}15` }}
                        title="Copy message"
                      >
                        {copiedId === i ? (
                          <Check className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" style={{ color: C.muted }} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-end gap-3"
                >
                  <AriaMark size={32} />
                  <div
                    className="rounded-3xl rounded-bl-md px-5 py-3.5"
                    style={{ background: C.white, border: `1px solid ${C.muted}20` }}
                  >
                    <TypingDots />
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="relative px-4 pb-6 pt-4 sm:px-8 shrink-0" style={{ background: C.white }}>
            <div className="space-y-2">
              {/* File/image preview */}
              {attachedFile && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: `${C.muted}12`, border: `1px solid ${C.muted}25` }}>
                  {attachedFile.type === 'image' ? (
                    <img decoding="async" loading="lazy" src={attachedFile.preview} alt="preview" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${C.turq}20` }}>
                      <FileText className="w-5 h-5" style={{ color: C.turq }} />
                    </div>
                  )}
                  <span className="text-xs flex-1 truncate" style={{ color: C.teal }}>{attachedFile.name}</span>
                  <button
                    onClick={() => setAttachedFile(null)}
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                    style={{ background: `${C.muted}20` }}
                  >
                    <X className="w-3.5 h-3.5" style={{ color: C.muted }} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-2xl pl-2 pr-2 py-2" style={{ background: C.white, border: `1px solid ${C.muted}30`, boxShadow: `0 6px 24px ${C.teal}10` }}>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {/* Attach button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-all"
                  style={{ background: `${C.muted}12`, color: C.muted }}
                  title="Attach image or file"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={t('ai_placeholder')}
                  disabled={loading}
                  autoFocus
                  className="flex-1 bg-transparent text-[14.5px] outline-none placeholder:opacity-60 disabled:opacity-60"
                  style={{ color: C.teal }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={(!input.trim() && !attachedFile) || loading}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${C.turq}, ${C.turqDeep})`, color: '#FFFFFF', boxShadow: `0 6px 18px ${C.turq}40` }}
                  aria-label="Send"
                >
                  {loading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <p className="mt-2.5 text-center text-[11px]" style={{ color: `${C.muted}AA` }}>
              {lang === 'fa'
                ? 'آریا می‌تواند با برنامه‌ریزی، ویزا، آداب محلی و راهنمایان کمک کند.'
                : lang === 'ar'
                ? 'يمكن لـ Aria المساعدة في المسارات والتأشيرات والعادات والمرشدين.'
                : 'Aria can help with itineraries, visas, customs, and local guides.'}
            </p>
          </div>

          {/* Mobile "Recommendations" floating button — hidden on lg+ */}
          <button
            onClick={() => setRecsSheetOpen(true)}
            className="lg:hidden fixed bottom-24 end-4 z-30 flex items-center gap-2 rounded-full px-4 py-3 text-[13px] font-semibold shadow-lg transition-all hover:opacity-90 active:scale-95"
            style={{ background: C.teal, color: C.white, boxShadow: `0 8px 24px ${C.teal}40` }}
            aria-label="Open recommendations"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>{lang === 'fa' ? 'پیشنهادات' : lang === 'ar' ? 'التوصيات' : 'Recommendations'}</span>
          </button>
        </section>

        {/* ── Profile + Recommendations sidebar — desktop only ─────────── */}
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="hidden lg:flex flex-col shrink-0 lg:h-full overflow-y-auto"
          style={{ width: 360, background: C.mist }}
        >
          <div className="pt-3">
            <RecommendationsPanelContent
              lang={lang}
              profile={profile}
              sidebarTours={sidebarTours}
              sidebarGuides={sidebarGuides}
              hasRecommendations={hasRecommendations}
            />
          </div>
        </motion.aside>
      </div>

      {/* ── Mobile recommendations Sheet ────────────────────────────────── */}
      <Sheet open={recsSheetOpen} onOpenChange={setRecsSheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl p-0 lg:hidden"
          style={{ background: C.mist, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        >
          <div dir={dir} lang={lang} className="flex flex-col" style={{ maxHeight: '85vh' }}>
            <SheetHeader
              className="shrink-0 px-6 py-4"
              style={{ borderBottom: `1px solid ${C.muted}20` }}
            >
              <SheetTitle style={{ color: C.teal, fontFamily: 'inherit' }}>
                {lang === 'fa' ? 'پیشنهادات سفر' : lang === 'ar' ? 'توصيات السفر' : 'Travel Recommendations'}
              </SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto flex-1">
              <RecommendationsPanelContent
                lang={lang}
                profile={profile}
                sidebarTours={sidebarTours}
                sidebarGuides={sidebarGuides}
                hasRecommendations={hasRecommendations}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Trip Builder Modal */}
      <TripBuilder
        isOpen={showTripBuilder}
        onClose={() => setShowTripBuilder(false)}
        lang={lang}
        dir={dir}
      />

      {/* Trip Request Form — pre-filled from AI trip planning flow */}
      <TripRequestForm
        isOpen={tripFormOpen}
        onClose={() => setTripFormOpen(false)}
        initialData={tripFormData}
        onSuccess={() => {
          setTripFormOpen(false);
          if (activeId) {
            appendMessage(activeId, {
              role: 'assistant',
              content: "Done! 🎉 Guides will reach out soon — the first 5 to accept can message you directly.",
            });
          }
        }}
      />

      {/* Trip Request Form — pre-filled from AI conversational draft */}
      <TripRequestForm
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        prefillData={draftForModal}
      />
    </div>
  );
}

// ── TourCard ──────────────────────────────────────────────────────────────────
function TourCard({ tour }) {
  const cities = Array.isArray(tour.cities) ? tour.cities.join(' · ') : (tour.cities || tour.location || '');
  const img = tour.image_url || (Array.isArray(tour.gallery) && tour.gallery[0]) ||
    'https://images.unsplash.com/photo-1564960723835-2898c9df9297?w=600&h=400&fit=crop';
  const href = tour.slug ? `/tours/${tour.slug}` : '/tours';
  return (
    <Link
      to={href}
      className="group flex gap-3 p-3 rounded-2xl bg-card border border-border/50 hover:border-accent/40 hover:shadow-md transition-all"
    >
      <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-secondary">
        <img decoding="async" loading="lazy" src={img} alt={tour.title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading text-sm font-semibold text-foreground truncate group-hover:text-accent transition-colors">
          {tour.title || 'Untitled tour'}
        </p>
        {cities && (
          <p className="font-body text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-accent" />
            {cities}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
          {tour.duration != null && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {tour.duration}d
            </span>
          )}
          {tour.price != null && (
            <span className="flex items-center gap-1 text-accent font-semibold">
              <DollarSign className="w-3 h-3" />
              {Number(tour.price).toLocaleString()}
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground self-center shrink-0 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}

// ── GuideCard ─────────────────────────────────────────────────────────────────
function GuideCard({ guide }) {
  const specialties = Array.isArray(guide.specialties) ? guide.specialties.slice(0, 2).join(' · ') : '';
  return (
    <Link
      to={`/guides/${guide.id}`}
      className="group flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/50 hover:border-accent/40 hover:shadow-md transition-all"
    >
      <img decoding="async" loading="lazy"
        src={avatarFor(guide)}
        alt=""
        className="w-12 h-12 rounded-full object-cover border-2 border-gold/40 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="font-heading text-sm font-semibold text-foreground truncate group-hover:text-accent transition-colors">
          {guide.full_name || 'Local guide'}
        </p>
        {guide.city && (
          <p className="font-body text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-accent" />
            {guide.city}
          </p>
        )}
        {specialties && (
          <p className="font-body text-[11px] text-muted-foreground truncate mt-0.5">{specialties}</p>
        )}
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-accent shrink-0 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}
