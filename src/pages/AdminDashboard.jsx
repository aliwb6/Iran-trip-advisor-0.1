import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Clock, Briefcase, Users, MessageSquare, Shield,
  Loader2, LogOut, CheckCircle2, XCircle, Edit2, Trash2, X, MapPin,
  DollarSign, Star, AlertTriangle, Send, Image as ImageIcon,
  Sparkles, PlusCircle, BookOpen, FileText, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { avatarFor } from '@/lib/avatar';
import TourForm from '@/components/dashboard/TourForm';
import { useAllArticlesAdmin } from '@/hooks/useSupabase';
import ArticleEditor from '@/components/articles/ArticleEditor';
import AdminChatMonitor from './AdminChatMonitor';
import {
  buildGuideReviewUpdates,
  checkProfileCompletion,
  getGuideApprovalEligibility,
  getGuideReviewValidationError,
  persistGuideReview,
} from '@/lib/profileCompletion';
import HomeDestinationsEditor from '@/components/admin/HomeDestinationsEditor';
import { buildReviewModerationUpdates, persistReviewModeration } from '@/lib/reviews';

// ─── Constants ───────────────────────────────────────────────────────────────

const NAV = [
  { id: 'overview', label: 'Overview',       Icon: LayoutDashboard },
  { id: 'pending',  label: 'Pending Tours',  Icon: Clock },
  { id: 'tours',    label: 'All Tours',      Icon: Briefcase },
  { id: 'platform', label: 'Platform Tours', Icon: Sparkles },
  { id: 'guides',   label: 'All Guides',     Icon: Users },
  { id: 'chats',    label: 'Chat Monitor',   Icon: MessageSquare },
  { id: 'comments', label: 'Comments',       Icon: MessageSquare },
  { id: 'articles', label: 'Articles',       Icon: BookOpen },
  { id: 'destinations', label: 'Homepage Wonders', Icon: ImageIcon },
];

const STATUS_CFG = {
  approved:       { label: 'Approved',       dot: 'bg-emerald-400', wrap: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' },
  pending:        { label: 'Pending',        dot: 'bg-yellow-400',  wrap: 'bg-yellow-500/20  border-yellow-500/30  text-yellow-300'  },
  published:      { label: 'Published',      dot: 'bg-emerald-400', wrap: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' },
  pending_review: { label: 'Pending Review', dot: 'bg-yellow-400',  wrap: 'bg-yellow-500/20  border-yellow-500/30  text-yellow-300'  },
  draft:          { label: 'Draft',          dot: 'bg-gray-400',    wrap: 'bg-gray-500/20    border-gray-500/30    text-gray-300'    },
  rejected:       { label: 'Rejected',       dot: 'bg-red-400',     wrap: 'bg-red-500/20     border-red-500/30     text-red-300'     },
};

const CARD = 'bg-[hsl(222,45%,14%)] border border-white/[0.08] rounded-2xl';

// ─── Shared atoms ────────────────────────────────────────────────────────────

function StatusPill({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${cfg.wrap}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StarRating({ rating = 0 }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${n <= rating ? 'text-[hsl(38,62%,58%)] fill-[hsl(38,62%,58%)]' : 'text-white/20'}`}
        />
      ))}
    </div>
  );
}

function ErrorBox({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm mb-5">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span className="flex-1 leading-relaxed">{message}</span>
      {onClose && (
        <button onClick={onClose} className="text-red-300/60 hover:text-red-300">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function SectionLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 text-[hsl(178,85%,45%)] animate-spin" />
    </div>
  );
}

function EmptyState({ Icon, title, desc }) {
  return (
    <div className={`${CARD} py-16 px-4 flex flex-col items-center text-center`}>
      <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-white/25" />
      </div>
      <p className="text-white/60 font-medium text-sm mb-1">{title}</p>
      {desc && <p className="text-white/35 text-xs max-w-xs">{desc}</p>}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function Sidebar({ section, onNavigate, counts, profile, onLogout }) {
  const initials = profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'AD';

  const badgeFor = (id) => {
    if (id === 'pending')  return counts.pending;
    if (id === 'tours')    return counts.tours;
    if (id === 'platform') return counts.platform;
    if (id === 'guides')   return counts.guides;
    if (id === 'comments') return counts.comments;
    if (id === 'articles') return counts.articles;
    return null;
  };

  return (
    <aside className="w-[210px] flex-shrink-0 h-screen sticky top-0 bg-[hsl(222,55%,8%)] border-r border-white/[0.07] flex flex-col overflow-y-auto">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.07]">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-[hsl(178,85%,32%)] flex items-center justify-center flex-shrink-0">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-semibold text-sm leading-tight">
            Iran Trip Advisor<br />
            <span className="text-[hsl(38,62%,58%)] font-normal text-[10px] tracking-wider uppercase">Admin Panel</span>
          </span>
        </Link>
      </div>

      {/* Admin info */}
      <div className="px-4 py-4 border-b border-white/[0.07]">
        <div className="w-9 h-9 rounded-xl bg-[hsl(178,85%,32%)] flex items-center justify-center mb-2">
          <span className="text-white text-sm font-bold">{initials}</span>
        </div>
        <p className="text-white text-xs font-medium leading-tight truncate">
          {profile?.full_name || 'Administrator'}
        </p>
        <p className="text-[hsl(38,62%,58%)] text-[10px] mt-0.5">Administrator</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.map(item => {
          const active = section === item.id;
          const badge = badgeFor(item.id);
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-medium transition-all duration-150 ${
                active
                  ? 'bg-[hsl(178,85%,32%)]/20 text-[hsl(178,85%,50%)]'
                  : 'text-white/55 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <span className="flex items-center gap-2.5">
                <item.Icon className="w-3.5 h-3.5 flex-shrink-0" />
                {item.label}
              </span>
              {badge !== null && badge > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  active ? 'bg-[hsl(178,85%,32%)]/30 text-[hsl(178,85%,60%)]' : 'bg-white/10 text-white/50'
                }`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 pb-4 border-t border-white/[0.07] pt-3">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

function OverviewView({ tours, guides, reviews, loading }) {
  if (loading) return <SectionLoader />;

  const pendingCount = tours.filter(t => t.status === 'pending_review' || t.status === 'draft').length;

  const stats = [
    { label: 'Total Tours',     value: tours.length,    color: 'text-white',                Icon: Briefcase },
    { label: 'Pending Review',  value: pendingCount,    color: 'text-yellow-400',           Icon: Clock },
    { label: 'Total Guides',    value: guides.length,   color: 'text-[hsl(178,85%,50%)]',   Icon: Users },
    { label: 'Total Comments',  value: reviews.length,  color: 'text-[hsl(38,62%,58%)]',    Icon: MessageSquare },
  ];

  const recentTours    = tours.slice(0, 5);
  const recentComments = reviews.slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Overview</h2>
        <span className="text-white/40 text-xs">Platform statistics</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className={`${CARD} p-5 flex items-center gap-3`}>
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0">
              <stat.Icon className={`w-4.5 h-4.5 ${stat.color}`} />
            </div>
            <div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-white/40 text-[11px]">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent tours */}
      <div className={`${CARD} p-5`}>
        <p className="text-white/70 text-sm font-semibold mb-4">Recent Tours</p>
        {recentTours.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-8">No tours yet</p>
        ) : (
          <div className="space-y-3">
            {recentTours.map(tour => (
              <div key={tour.id} className="flex items-center gap-3 pb-3 border-b border-white/[0.06] last:border-0 last:pb-0">
                <div className="w-10 h-10 rounded-xl bg-white/5 overflow-hidden flex-shrink-0">
                  {tour.image_url ? (
                    <img decoding="async" loading="lazy" src={tour.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-white/20" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-medium truncate">{tour.title || 'Untitled'}</p>
                  <p className="text-white/35 text-[10px] mt-0.5">{tour.profiles?.full_name || 'Unknown guide'}</p>
                </div>
                <StatusPill status={tour.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent comments */}
      <div className={`${CARD} p-5`}>
        <p className="text-white/70 text-sm font-semibold mb-4">Recent Comments</p>
        {recentComments.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-8">No comments yet</p>
        ) : (
          <div className="space-y-4">
            {recentComments.map(r => (
              <div key={r.id} className="flex items-start gap-3 pb-3 border-b border-white/[0.06] last:border-0 last:pb-0">
                <div className="w-8 h-8 rounded-full bg-[hsl(178,85%,32%)]/30 flex items-center justify-center flex-shrink-0 text-[hsl(178,85%,50%)] text-xs font-bold">
                  {(r.reviewer?.full_name || r.reviewer_name)?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-white text-xs font-medium">{r.reviewer?.full_name || r.reviewer_name || 'Anonymous'}</p>
                    <StarRating rating={r.rating || 0} />
                  </div>
                  {r.review_text && (
                    <p className="text-white/45 text-[11px] leading-relaxed line-clamp-2">{r.review_text}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Platform Tours ──────────────────────────────────────────────────────────

function PlatformToursView({ tours, loading, busyId, onSaved, onDelete }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing]   = useState(null);

  if (loading) return <SectionLoader />;

  if (creating || editing) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setCreating(false); setEditing(null); }}
          className="text-white/40 text-xs hover:text-white transition"
        >
          ← Back to Platform Tours
        </button>
        <TourForm
          key={editing?.id || 'new'}
          editing={editing}
          isPlatform={true}
          onDone={(saved, isNew) => {
            onSaved(saved, isNew);
            if (!isNew) { setEditing(null); }
          }}
          onCancel={() => { setCreating(false); setEditing(null); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">Platform Tours</h2>
          <p className="text-white/40 text-xs mt-0.5">Tours owned and curated by the platform itself</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[hsl(178,85%,32%)] text-white text-sm font-semibold hover:bg-[hsl(178,85%,28%)] transition"
        >
          <PlusCircle className="w-4 h-4" />
          Add Platform Tour
        </button>
      </div>

      {tours.length === 0 ? (
        <EmptyState
          Icon={Sparkles}
          title="No platform tours yet"
          desc="Create your first curated platform tour — it will be auto-published and featured on the homepage."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tours.map(tour => {
            const busy = busyId === tour.id;
            return (
              <div key={tour.id} className={`${CARD} overflow-hidden flex flex-col`}>
                <div className="aspect-[16/9] bg-white/[0.04] relative overflow-hidden">
                  {tour.image_url ? (
                    <img decoding="async" loading="lazy" src={tour.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-white/15" />
                    </div>
                  )}
                  <div className="absolute top-2 start-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-[hsl(38,62%,52%)]/20 border border-[hsl(38,62%,52%)]/30 text-[hsl(38,62%,75%)] text-[10px] font-semibold">
                    <Sparkles className="w-3 h-3" />
                    Platform
                  </div>
                  <div className="absolute top-2 end-2">
                    <StatusPill status={tour.status || 'published'} />
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <p className="text-white font-semibold text-sm truncate">{tour.title || 'Untitled'}</p>
                  <p className="text-white/40 text-[11px] truncate mt-0.5">
                    {tour.location || '—'}
                    {tour.duration ? ` · ${tour.duration} days` : ''}
                  </p>
                  {tour.price != null && (
                    <p className="text-[hsl(178,85%,55%)] text-xs font-semibold mt-2">
                      ${Number(tour.price).toLocaleString()}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                    <button
                      disabled={busy}
                      onClick={() => setEditing(tour)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.06] text-white/70 text-xs font-medium hover:bg-white/[0.12] hover:text-white transition disabled:opacity-50"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => onDelete(tour.id)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tour Edit Modal ─────────────────────────────────────────────────────────

function TourEditModal({ tour, onSave, onClose }) {
  const [form, setForm] = useState({
    title:       tour.title || '',
    description: tour.description || '',
    price:       tour.price != null ? String(tour.price) : '',
    duration:    tour.duration != null ? String(tour.duration) : '',
    status:      tour.status || 'draft',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const ic = 'w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[hsl(178,85%,32%)]/60 focus:ring-1 focus:ring-[hsl(178,85%,32%)]/30 transition';
  const lc = 'block text-white/50 text-xs mb-1.5 font-medium';

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        title:       form.title,
        description: form.description,
        price:       form.price ? Number(form.price) : null,
        duration:    form.duration ? Number(form.duration) : null,
        status:      form.status,
      };
      const { data, error: err } = await supabase
        .from('tours').update(payload).eq('id', tour.id).select().single();
      if (err) throw err;
      onSave(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full max-w-lg ${CARD} p-6 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold">Edit Tour</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/50 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <ErrorBox message={error} onClose={() => setError('')} />

        <div className="space-y-4">
          <div>
            <label className={lc}>Title</label>
            <input className={ic} value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label className={lc}>Description</label>
            <textarea rows={4} className={`${ic} resize-none`} value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lc}>Price (USD)</label>
              <input type="number" className={ic} value={form.price}
                onChange={e => setForm(p => ({ ...p, price: e.target.value }))} />
            </div>
            <div>
              <label className={lc}>Duration (days)</label>
              <input type="number" className={ic} value={form.duration}
                onChange={e => setForm(p => ({ ...p, duration: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className={lc}>Status</label>
            <select className={`${ic} cursor-pointer [color-scheme:dark]`} value={form.status}
              onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              {Object.entries(STATUS_CFG).map(([v, c]) => (
                <option key={v} value={v} className="bg-[hsl(222,45%,14%)] text-white">{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[hsl(178,85%,32%)] hover:bg-[hsl(178,85%,38%)] text-white text-sm font-semibold disabled:opacity-60 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save Changes
          </button>
          <button onClick={onClose}
            className="px-5 py-2 rounded-xl border border-white/15 text-white/50 hover:text-white hover:border-white/30 text-sm transition">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tour Card (reused for pending + all tours) ──────────────────────────────

function TourRow({ tour, busyId, onApprove, onReject, onEdit }) {
  const busy = busyId === tour.id;
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-start gap-4">
        {tour.image_url ? (
          <img decoding="async" loading="lazy" src={tour.image_url} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
            <ImageIcon className="w-5 h-5 text-white/20" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-white font-semibold text-sm line-clamp-1">{tour.title || 'Untitled'}</h3>
            <StatusPill status={tour.status} />
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-white/40 text-[11px] mb-3">
            {tour.profiles?.full_name && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />{tour.profiles.full_name}
              </span>
            )}
            {tour.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />{tour.location}
              </span>
            )}
            {tour.duration && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />{tour.duration}d
              </span>
            )}
            {tour.price && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />{Number(tour.price).toLocaleString()}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {tour.status !== 'published' && (
              <button
                disabled={busy}
                onClick={() => onApprove(tour.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-medium transition disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Approve
              </button>
            )}
            {tour.status !== 'rejected' && (
              <button
                disabled={busy}
                onClick={() => onReject(tour.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-medium transition disabled:opacity-50"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Reject
              </button>
            )}
            <button
              onClick={() => onEdit(tour)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[hsl(178,85%,32%)]/15 hover:bg-[hsl(178,85%,32%)]/25 text-[hsl(178,85%,55%)] text-xs font-medium transition"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pending Tours View ──────────────────────────────────────────────────────

function PendingToursView({ tours, loading, onApprove, onReject, onEdit, busyId }) {
  if (loading) return <SectionLoader />;

  const pending = tours.filter(t => t.status === 'pending_review' || t.status === 'draft');

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white font-bold text-lg">Pending Tours</h2>
        <span className="text-white/40 text-xs">
          {pending.length} awaiting review
        </span>
      </div>

      {pending.length === 0 ? (
        <EmptyState
          Icon={CheckCircle2}
          title="All caught up"
          desc="No tours waiting for review right now."
        />
      ) : (
        <div className="space-y-3">
          {pending.map(tour => (
            <TourRow
              key={tour.id}
              tour={tour}
              busyId={busyId}
              onApprove={onApprove}
              onReject={onReject}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── All Tours View ──────────────────────────────────────────────────────────

function AllToursView({ tours, loading, onApprove, onReject, onEdit, busyId }) {
  const [filter, setFilter] = useState('all');

  if (loading) return <SectionLoader />;

  const filtered = filter === 'all' ? tours : tours.filter(t => t.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-bold text-lg">All Tours</h2>
          <span className="text-white/40 text-xs">{tours.length} total</span>
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-white/10 bg-[hsl(222,45%,14%)] text-white text-xs focus:outline-none focus:border-[hsl(178,85%,32%)]/60 cursor-pointer [color-scheme:dark]"
        >
          <option value="all" className="bg-[hsl(222,45%,14%)] text-white">All Statuses</option>
          {Object.entries(STATUS_CFG).map(([v, c]) => (
            <option key={v} value={v} className="bg-[hsl(222,45%,14%)] text-white">{c.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState Icon={Briefcase} title="No tours found" desc="Try adjusting the filter." />
      ) : (
        <div className="space-y-3">
          {filtered.map(tour => (
            <TourRow
              key={tour.id}
              tour={tour}
              busyId={busyId}
              onApprove={onApprove}
              onReject={onReject}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Guides View ─────────────────────────────────────────────────────────────

function GuidesView({ guides, loading, onReviewProfile, busyId }) {
  const [sortBy, setSortBy] = useState('newest');

  if (loading) return <SectionLoader />;

  const sorted = [...guides].sort((a, b) => {
    if (sortBy === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
    if (sortBy === 'name') return (a.full_name || '').localeCompare(b.full_name || '');
    if (sortBy === 'city') return (a.city || '').localeCompare(b.city || '');
    if (sortBy === 'role') return (a.role || '').localeCompare(b.role || '');
    if (sortBy === 'status') {
      const rank = (guide) => guide.is_approved ? 0 : guide.is_rejected ? 2 : 1;
      return rank(a) - rank(b);
    }
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-bold text-lg">All Guides</h2>
          <span className="text-white/40 text-xs">{guides.length} total</span>
        </div>
        <select
          value={sortBy}
          onChange={event => setSortBy(event.target.value)}
          aria-label="Sort guides"
          className="px-3 py-2 rounded-xl border border-white/10 bg-[hsl(222,45%,14%)] text-white text-xs focus:outline-none focus:border-[hsl(178,85%,32%)]/60 min-w-48 [color-scheme:dark]"
        >
          <option value="newest" className="bg-[hsl(222,45%,14%)] text-white">Sort by: Newest</option>
          <option value="oldest" className="bg-[hsl(222,45%,14%)] text-white">Sort by: Oldest</option>
          <option value="name" className="bg-[hsl(222,45%,14%)] text-white">Sort by: Name A–Z</option>
          <option value="city" className="bg-[hsl(222,45%,14%)] text-white">Sort by: City</option>
          <option value="role" className="bg-[hsl(222,45%,14%)] text-white">Sort by: Guide / Agency</option>
          <option value="status" className="bg-[hsl(222,45%,14%)] text-white">Sort by: Approval status</option>
        </select>
      </div>

      {sorted.length === 0 ? (
        <EmptyState Icon={Users} title="No profiles found" desc="Guide and agency profiles will appear here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map(guide => {
            const busy = busyId === guide.id;
            const comp = checkProfileCompletion(guide);
            return (
              <div key={guide.id} className={`${CARD} p-4`}>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-[hsl(178,85%,32%)]/20 border border-[hsl(178,85%,32%)]/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <img decoding="async" loading="lazy" src={avatarFor(guide)} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{guide.full_name || 'Unnamed'}</p>
                    <p className="text-white/40 text-[11px] truncate">{guide.email}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0 ${
                    guide.is_approved
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                      : guide.is_rejected
                        ? 'bg-red-500/15 text-red-400 border-red-500/25'
                        : 'bg-gray-500/15 text-gray-400 border-gray-500/25'
                  }`}>
                    {guide.is_approved ? 'Approved' : guide.is_rejected ? 'Rejected' : 'Pending'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px]">
                  <span className={`px-2 py-0.5 rounded-full font-medium border capitalize ${
                    guide.role === 'agency'
                      ? 'bg-[hsl(38,62%,58%)]/15 text-[hsl(38,62%,58%)] border-[hsl(38,62%,58%)]/25'
                      : 'bg-[hsl(178,85%,32%)]/15 text-[hsl(178,85%,55%)] border-[hsl(178,85%,32%)]/25'
                  }`}>
                    {guide.role || 'guide'}
                  </span>
                  {guide.city && (
                    <span className="flex items-center gap-1 text-white/40">
                      <MapPin className="w-3 h-3" />{guide.city}
                    </span>
                  )}
                  {/* Profile completion badge */}
                  <span className={`px-2 py-0.5 rounded-full font-medium border ${
                    comp.completed
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                      : 'bg-amber-500/15 text-amber-400 border-amber-500/25'
                  }`}>
                    {comp.completed ? 'Profile Complete' : `Incomplete — ${comp.passed}/${comp.total}`}
                  </span>
                  {guide.license_status === 'pending_review' && !guide.is_approved && !guide.is_rejected && (
                    <span className="px-2 py-0.5 rounded-full font-medium border bg-blue-500/15 text-blue-400 border-blue-500/25">
                      Review Requested
                    </span>
                  )}
                </div>

                <button
                  onClick={() => onReviewProfile(guide)}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition border bg-[hsl(178,85%,32%)]/10 border-[hsl(178,85%,32%)]/25 text-[hsl(178,85%,55%)] hover:bg-[hsl(178,85%,32%)]/20 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Edit2 className="w-3.5 h-3.5" />}
                  View &amp; review profile
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GuideProfileReviewModal({ guide, busy, onClose, onSave }) {
  const initialTourTypes = Array.isArray(guide.tour_types)
    ? guide.tour_types
    : Array.isArray(guide.specialties)
      ? guide.specialties
      : guide.specialty
        ? [guide.specialty]
        : [];
  const [form, setForm] = useState({
    full_name: guide.full_name || '',
    email: guide.email || '',
    phone: guide.phone || '',
    city: guide.city || '',
    bio: guide.bio || '',
    languages: Array.isArray(guide.languages) ? guide.languages.join(', ') : guide.languages || '',
    tourTypes: initialTourTypes.join(', '),
    license_status: guide.license_status || 'not_uploaded',
  });
  const [rejectionReason, setRejectionReason] = useState(guide.approval_rejection_reason || '');
  const [localError, setLocalError] = useState('');
  const [openingLicense, setOpeningLicense] = useState(false);
  const hasLicense = Boolean(guide.license_url?.trim());
  const parsedTourTypes = form.tourTypes.split(/[,،;]/).map(value => value.trim()).filter(Boolean);
  const reviewProfile = {
    ...guide,
    ...form,
    specialty: parsedTourTypes[0] || '',
    specialties: guide.role === 'guide' ? parsedTourTypes : guide.specialties,
    tour_types: guide.role === 'agency' ? parsedTourTypes : guide.tour_types,
  };
  const approvalEligibility = getGuideApprovalEligibility(reviewProfile, { submitting: busy });
  const completion = approvalEligibility;
  const profileHref = guide.role === 'agency' ? `/agencies/${guide.id}` : `/guides/${guide.id}`;
  const inputClass = 'w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[hsl(178,85%,32%)]/60';

  const set = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const viewLicense = async () => {
    if (!hasLicense || openingLicense) return;
    setOpeningLicense(true);
    setLocalError('');
    try {
      if (/^https?:\/\//i.test(guide.license_url)) {
        window.open(guide.license_url, '_blank', 'noopener,noreferrer');
        return;
      }
      const { data, error } = await supabase.storage
        .from('licenses')
        .createSignedUrl(guide.license_url, 60);
      if (error) throw error;
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setLocalError(error.message || 'The license document could not be opened.');
    } finally {
      setOpeningLicense(false);
    }
  };
  const submit = async (decision) => {
    const reason = rejectionReason.trim();
    const validationError = getGuideReviewValidationError({
      decision,
      profile: reviewProfile,
      rejectionReason: reason,
    });
    if (validationError) {
      setLocalError(validationError);
      return;
    }
    if (form.license_status === 'verified' && !hasLicense) {
      setLocalError('A license document must be uploaded before it can be marked as verified.');
      return;
    }
    setLocalError('');
    const updates = buildGuideReviewUpdates({
      guide,
      form,
      parsedTourTypes,
      decision,
      rejectionReason: reason,
      reviewedAt: new Date().toISOString(),
    });
    try {
      const saved = await onSave(guide, updates, decision);
      if (saved) onClose();
    } catch (error) {
      setLocalError(error.message || 'The profile review could not be saved.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[hsl(222,45%,12%)] border border-white/10 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-5 py-4 bg-[hsl(222,45%,12%)] border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <img src={avatarFor(guide)} alt="" className="w-11 h-11 rounded-xl object-cover bg-white/5" />
            <div className="min-w-0">
              <h3 className="text-white font-semibold truncate">{form.full_name || 'Unnamed profile'}</h3>
              <p className="text-white/40 text-xs capitalize">{guide.role}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 text-white/50 hover:text-white flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-white/50">Profile completion: <span className={completion.completed ? 'text-emerald-400' : 'text-amber-400'}>{completion.percentage}%</span></div>
            <Link to={profileHref} target="_blank" rel="noreferrer" className="text-xs text-[hsl(178,85%,55%)] hover:underline">Open public profile</Link>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-xs text-white/50">Full name<input value={form.full_name} onChange={e => set('full_name', e.target.value)} className={`${inputClass} mt-1.5`} /></label>
            <label className="text-xs text-white/50">Email<input value={form.email} onChange={e => set('email', e.target.value)} className={`${inputClass} mt-1.5`} dir="ltr" /></label>
            <label className="text-xs text-white/50">Phone<input value={form.phone} onChange={e => set('phone', e.target.value)} className={`${inputClass} mt-1.5`} dir="ltr" /></label>
            <label className="text-xs text-white/50">City<input value={form.city} onChange={e => set('city', e.target.value)} className={`${inputClass} mt-1.5`} /></label>
            <label className="text-xs text-white/50">Languages<input value={form.languages} onChange={e => set('languages', e.target.value)} className={`${inputClass} mt-1.5`} placeholder="English, Persian" /></label>
            <label className="text-xs text-white/50">{guide.role === 'agency' ? 'Tour types' : 'Tour types / specialties'}<input value={form.tourTypes} onChange={e => set('tourTypes', e.target.value)} className={`${inputClass} mt-1.5`} placeholder="Cultural, Nature, Photography" /></label>
            <label className="text-xs text-white/50">License status
              <select value={form.license_status} onChange={e => set('license_status', e.target.value)} className={`${inputClass} mt-1.5 [color-scheme:dark]`}>
                <option value="not_uploaded" className="bg-[hsl(222,45%,14%)] text-white">Not uploaded</option><option value="pending_review" className="bg-[hsl(222,45%,14%)] text-white">Pending review</option><option value="verified" disabled={!hasLicense} className="bg-[hsl(222,45%,14%)] text-white">Verified</option><option value="rejected" className="bg-[hsl(222,45%,14%)] text-white">Rejected</option>
              </select>
            </label>

            <div className={`sm:col-span-2 rounded-xl border p-4 ${hasLicense ? 'bg-emerald-500/[0.06] border-emerald-500/20' : 'bg-white/[0.03] border-white/10'}`}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hasLicense ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/[0.06] text-white/35'}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">License document</p>
                    <p className={`text-xs mt-0.5 ${hasLicense ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {hasLicense ? 'Uploaded — ready for admin review' : 'No license document has been uploaded'}
                    </p>
                  </div>
                </div>
                {hasLicense && (
                  <button type="button" onClick={viewLicense} disabled={openingLicense} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[hsl(178,85%,32%)]/15 border border-[hsl(178,85%,32%)]/30 text-[hsl(178,85%,55%)] text-xs font-medium hover:bg-[hsl(178,85%,32%)]/25 disabled:opacity-50">
                    {openingLicense ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                    {openingLicense ? 'Opening…' : 'View uploaded license'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <label className="block text-xs text-white/50">Bio<textarea rows={5} value={form.bio} onChange={e => set('bio', e.target.value)} className={`${inputClass} mt-1.5 resize-y`} /></label>

          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
            <label className="block text-xs text-red-300">Rejection reason (required when rejecting)
              <textarea rows={3} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} className={`${inputClass} mt-1.5 border-red-500/20`} placeholder="Explain what must be corrected before resubmission…" />
            </label>
          </div>
          {localError && <p className="text-red-400 text-xs">{localError}</p>}

          <div className="flex items-center justify-end gap-2 flex-wrap pt-2 border-t border-white/10">
            <button disabled={busy} onClick={() => submit('save')} className="px-4 py-2 rounded-xl bg-white/8 text-white/70 text-xs hover:bg-white/12 disabled:opacity-50">Save changes</button>
            <button disabled={busy} onClick={() => submit('reject')} className="px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs hover:bg-red-500/25 disabled:opacity-50">Reject profile</button>
            {!guide.is_approved && (
              <button disabled={!approvalEligibility.canApprove} onClick={() => submit('approve')} title={!completion.completed ? 'All required profile fields and an uploaded license are needed before approval.' : ''} className="px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs hover:bg-emerald-500/25 disabled:opacity-40">{busy ? 'Saving…' : 'Approve profile'}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Comment Card ────────────────────────────────────────────────────────────

function CommentCard({ review, onReply, onModerate, busy }) {
  const [reply, setReply] = useState(review.admin_reply || '');
  const [reviewText, setReviewText] = useState(review.review_text || review.body || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setReply(review.admin_reply || '');
    setReviewText(review.review_text || review.body || '');
  }, [review.id, review.admin_reply, review.review_text, review.body]);

  const handleSaveReply = async () => {
    setSaving(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('reviews')
        .update({ admin_reply: reply.trim() })
        .eq('id', review.id)
        .select('id, admin_reply');
      if (err) throw err;
      if (!Array.isArray(data) || data.length !== 1) {
        throw new Error(data?.length > 1 ? 'Multiple reviews matched this reply.' : 'Review not found for reply.');
      }
      setReply(data[0].admin_reply || '');
      onReply(review.id, data[0].admin_reply || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const date = review.created_at
    ? new Date(review.created_at).toLocaleDateString()
    : '';
  const reviewerEmail = review.reviewer?.email || review.reviewer_email || '';
  const targetName = review.target_profile?.full_name
    || review.guide?.full_name
    || review.agency?.agency_name
    || review.agency?.full_name
    || review.tours?.title
    || 'Unknown target';
  const targetType = review.target_profile?.role === 'agency'
    ? 'Agency'
    : review.target_profile?.role === 'guide'
      ? 'Guide'
      : review.guide_id
        ? 'Guide'
        : review.agency_id
          ? 'Agency'
          : 'Tour';

  const handleModeration = async (decision) => {
    setError('');
    try {
      await onModerate(review, decision, reviewText);
    } catch (moderationError) {
      setError(moderationError.message || 'The review could not be updated.');
    }
  };

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[hsl(178,85%,32%)]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[hsl(178,85%,55%)] font-bold text-xs">
              {(review.reviewer?.full_name || review.reviewer_name)?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-white font-semibold text-sm">{review.reviewer?.full_name || review.reviewer_name || 'Anonymous'}</p>
              <StarRating rating={review.rating || 0} />
              <StatusPill status={review.status || 'pending'} />
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/35">
              <span className="text-[hsl(38,62%,58%)]/80">{targetType}: {targetName}</span>
              {reviewerEmail && <span>· {reviewerEmail}</span>}
              {date && <span>· {date}</span>}
            </div>
          </div>
        </div>
      </div>

      {review.title && <p className="mb-2 pl-12 text-sm font-semibold text-white/80">{review.title}</p>}

      <div className="mb-4 pl-12">
        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">
          Review text
        </label>
        <textarea
          rows={4}
          value={reviewText}
          onChange={event => setReviewText(event.target.value)}
          className="w-full resize-y rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-sm leading-relaxed text-white/75 focus:border-[hsl(178,85%,32%)]/60 focus:outline-none focus:ring-1 focus:ring-[hsl(178,85%,32%)]/30"
        />
      </div>

      {review.admin_reply && (
        <div className="mb-4 pl-12">
          <div className="p-3 rounded-xl bg-[hsl(178,85%,32%)]/10 border border-[hsl(178,85%,32%)]/20">
            <p className="text-[hsl(178,85%,55%)] text-[10px] font-semibold mb-1 uppercase tracking-wider">
              Current Admin Reply
            </p>
            <p className="text-white/70 text-xs leading-relaxed">{review.admin_reply}</p>
          </div>
        </div>
      )}

      <ErrorBox message={error} onClose={() => setError('')} />

      <div className="mb-4 flex flex-wrap justify-end gap-2 border-b border-white/[0.07] pb-4 pl-12">
        <button
          type="button"
          onClick={() => handleModeration('save')}
          disabled={busy || !reviewText.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.07] px-3.5 py-2 text-xs font-semibold text-white/70 hover:bg-white/[0.12] disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Edit2 className="h-3.5 w-3.5" />}
          Save edits
        </button>
        <button
          type="button"
          onClick={() => handleModeration('reject')}
          disabled={busy || !reviewText.trim() || review.status === 'rejected'}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/25 bg-red-500/15 px-3.5 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/25 disabled:opacity-40"
        >
          <XCircle className="h-3.5 w-3.5" />
          Reject
        </button>
        <button
          type="button"
          onClick={() => handleModeration('approve')}
          disabled={busy || !reviewText.trim() || review.status === 'approved'}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/15 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-40"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Approve
        </button>
      </div>

      <div className="pl-12 space-y-2">
        <textarea
          rows={2}
          value={reply}
          onChange={e => setReply(e.target.value)}
          placeholder="Write a reply as admin..."
          className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.05] text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[hsl(178,85%,32%)]/60 focus:ring-1 focus:ring-[hsl(178,85%,32%)]/30 transition resize-none"
        />
        <button
          onClick={handleSaveReply}
          disabled={saving || !reply.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[hsl(178,85%,32%)] hover:bg-[hsl(178,85%,38%)] text-white text-xs font-semibold disabled:opacity-50 transition"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {review.admin_reply ? 'Update Reply' : 'Save Reply'}
        </button>
      </div>
    </div>
  );
}

function CommentsView({ reviews, loading, onReply, onModerate, busyId }) {
  const [filter, setFilter] = useState('pending');
  const [sortBy, setSortBy] = useState('newest');
  if (loading) return <SectionLoader />;

  const filtered = filter === 'all' ? reviews : reviews.filter(review => (review.status || 'pending') === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    if (sortBy === 'rating-high') return Number(b.rating || 0) - Number(a.rating || 0);
    if (sortBy === 'rating-low') return Number(a.rating || 0) - Number(b.rating || 0);
    if (sortBy === 'unreplied') return Number(Boolean(a.admin_reply)) - Number(Boolean(b.admin_reply));
    const statusOrder = { pending: 0, approved: 1, rejected: 2 };
    const statusDifference = (statusOrder[a.status || 'pending'] ?? 3) - (statusOrder[b.status || 'pending'] ?? 3);
    if (statusDifference) return statusDifference;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <div className="flex items-center gap-3"><h2 className="text-white font-bold text-lg">Comments / Reviews</h2><span className="text-white/40 text-xs">{reviews.length} total</span></div>
        <select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Sort comments" className="px-3 py-2 rounded-xl border border-white/10 bg-[hsl(222,45%,14%)] text-white text-xs focus:outline-none focus:border-[hsl(178,85%,32%)]/60 [color-scheme:dark]">
          <option value="newest" className="bg-[hsl(222,45%,14%)] text-white">Sort by: Newest</option><option value="oldest" className="bg-[hsl(222,45%,14%)] text-white">Sort by: Oldest</option><option value="rating-high" className="bg-[hsl(222,45%,14%)] text-white">Sort by: Highest rating</option><option value="rating-low" className="bg-[hsl(222,45%,14%)] text-white">Sort by: Lowest rating</option><option value="unreplied" className="bg-[hsl(222,45%,14%)] text-white">Sort by: Unreplied first</option>
        </select>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {['pending', 'approved', 'rejected', 'all'].map(status => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold capitalize transition ${
              filter === status
                ? 'border-[hsl(178,85%,32%)]/50 bg-[hsl(178,85%,32%)]/20 text-[hsl(178,85%,55%)]'
                : 'border-white/10 bg-white/[0.04] text-white/45 hover:text-white/70'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <EmptyState Icon={MessageSquare} title={`No ${filter === 'all' ? '' : `${filter} `}reviews`} desc="Submitted traveler reviews will appear here." />
      ) : (
        <div className="space-y-4">
          {sorted.map(review => (
            <CommentCard
              key={review.id}
              review={review}
              busy={busyId === review.id}
              onReply={onReply}
              onModerate={onModerate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Articles View ────────────────────────────────────────────────────────────

const ART_STATUS = {
  approved: { label: 'منتشر شده',      cls: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  pending:  { label: 'در انتظار',      cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  rejected: { label: 'رد شده',         cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

function ArticlesView({ profile }) {
  const { articles, loading, refetch } = useAllArticlesAdmin();
  const [filter, setFilter] = useState('pending');
  const [showEditor, setShowEditor] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const filtered = filter === 'all' ? articles : articles.filter(a => a.status === filter);

  const setStatus = async (id, status, adminNote) => {
    setBusyId(id);
    const update = { status };
    if (adminNote !== undefined) update.admin_note = adminNote;
    if (status === 'approved') { update.is_published = true; }
    const { error } = await supabase.from('articles').update(update).eq('id', id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'approved' ? 'مقاله تایید شد.' : 'مقاله رد شد.');
    refetch();
  };

  const toggleFeatured = async (article) => {
    setBusyId(article.id);
    const { error } = await supabase
      .from('articles')
      .update({ is_featured: !article.is_featured })
      .eq('id', article.id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(article.is_featured ? 'از ویژه‌ها حذف شد.' : 'به ویژه‌ها اضافه شد.');
    refetch();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('این مقاله حذف شود؟')) return;
    setBusyId(id);
    const { error } = await supabase.from('articles').delete().eq('id', id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success('مقاله حذف شد.');
    refetch();
  };

  const pendingCount = articles.filter(a => a.status === 'pending').length;

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-bold text-lg">Articles</h2>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
              {pendingCount} در انتظار
            </span>
          )}
        </div>
        <button
          onClick={() => setShowEditor(v => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors"
        >
          {showEditor ? 'بستن فرم' : '+ مقاله جدید'}
        </button>
      </div>

      {showEditor && (
        <ArticleEditor
          userId={profile?.id}
          authorType="admin"
          onSuccess={() => { setShowEditor(false); refetch(); }}
          onCancel={() => setShowEditor(false)}
        />
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'pending',  label: 'در انتظار' },
          { key: 'approved', label: 'منتشر شده' },
          { key: 'rejected', label: 'رد شده' },
          { key: 'all',      label: 'همه' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all ${
              filter === tab.key
                ? 'bg-teal-600 text-white border-teal-600'
                : 'border-white/10 text-white/50 hover:text-white hover:border-white/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <SectionLoader />
      ) : filtered.length === 0 ? (
        <EmptyState Icon={BookOpen} title="مقاله‌ای یافت نشد" desc="مقاله‌ای در این دسته وجود ندارد." />
      ) : (
        <div className="space-y-4">
          {filtered.map(article => {
            const s = ART_STATUS[article.status] || ART_STATUS.pending;
            const busy = busyId === article.id;
            return (
              <div key={article.id} className={`${CARD} p-4`}>
                <div className="flex gap-4 items-start">
                  {article.image_url ? (
                    <img decoding="async" loading="lazy"
                      src={article.image_url}
                      alt=""
                      className="w-20 h-16 rounded-xl object-cover shrink-0 border border-white/10"
                    />
                  ) : (
                    <div className="w-20 h-16 rounded-xl bg-white/[0.06] shrink-0 flex items-center justify-center border border-white/10">
                      <BookOpen className="w-5 h-5 text-white/20" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="text-white font-semibold text-sm flex-1 truncate">{article.title_fa || 'بدون عنوان'}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 ${s.cls}`}>
                        {s.label}
                      </span>
                      {article.is_featured && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium shrink-0 bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                          ⭐ ویژه
                        </span>
                      )}
                    </div>
                    {article.excerpt_fa && (
                      <p className="text-xs text-white/50 mt-1 line-clamp-2">{article.excerpt_fa}</p>
                    )}
                    <p className="text-[10px] text-white/30 mt-1">
                      {article.author_profile?.full_name || '—'} ·{' '}
                      {new Date(article.created_at).toLocaleDateString('fa-IR')}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-white/[0.06]">
                  {article.status !== 'approved' && (
                    <button
                      disabled={busy}
                      onClick={() => setStatus(article.id, 'approved')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 text-xs font-medium transition disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      تایید
                    </button>
                  )}
                  {article.status !== 'rejected' && (
                    <button
                      disabled={busy}
                      onClick={() => setStatus(article.id, 'rejected')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-medium transition disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      رد
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => toggleFeatured(article)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 text-xs font-medium transition disabled:opacity-50"
                  >
                    <Star className={`w-3.5 h-3.5 ${article.is_featured ? 'fill-yellow-400' : ''}`} />
                    {article.is_featured ? 'حذف از ویژه' : 'افزودن به ویژه'}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => handleDelete(article.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition disabled:opacity-50 ms-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main AdminDashboard ─────────────────────────────────────────────────────

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [section, setSection] = useState('overview');
  const [profile, setProfile] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [tours, setTours]     = useState([]);
  const [guides, setGuides]   = useState([]);
  const [reviews, setReviews] = useState([]);

  const [loadingTours,    setLoadingTours]    = useState(true);
  const [loadingGuides,   setLoadingGuides]   = useState(true);
  const [loadingReviews,  setLoadingReviews]  = useState(true);

  const [error, setError]   = useState('');
  const [busyId, setBusyId] = useState(null);
  const [editingTour, setEditingTour] = useState(null);
  const [reviewingGuide, setReviewingGuide] = useState(null);

  // ── Auth guard ──
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) { navigate('/login'); return; }

        const { data: prof, error: err } = await supabase
          .from('profiles')
          .select('id, full_name, role, is_admin')
          .eq('id', user.id)
          .single();
        if (cancelled) return;
        if (err) throw err;
        const isAdminUser = prof && (prof.role === 'admin' || prof.is_admin === true);
        if (!isAdminUser) { navigate('/'); return; }

        setProfile(prof);
        setAuthChecked(true);
      } catch (err) {
        setError(err.message);
        setAuthChecked(true);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [navigate]);

  // ── Fetchers ──
  const fetchTours = async () => {
    setLoadingTours(true);
    try {
      const { data, error: err } = await supabase
        .from('tours')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setTours(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTours(false);
    }
  };

  const fetchGuides = async () => {
    setLoadingGuides(true);
    try {
      const { data, error: err } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, city, bio, languages, avatar_url, role, specialty, specialties, tour_types, license_url, license_status, is_approved, is_rejected, is_published, approval_rejection_reason, approval_reviewed_at')
        .in('role', ['guide', 'agency'])
        .order('created_at', { ascending: false });
      if (err) throw err;
      setGuides(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingGuides(false);
    }
  };

  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      const { data, error: err } = await supabase
        .from('reviews')
        .select(`
          *,
          tours(title),
          target_profile:profiles!reviews_profile_id_fkey(id, full_name, role),
          reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setReviews(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    if (!authChecked || !profile) return;
    fetchTours();
    fetchGuides();
    fetchReviews();
  }, [authChecked, profile]);

  // ── Actions ──
  const changeTourStatus = async (id, status) => {
    setBusyId(id);
    setError('');
    try {
      const { error: err } = await supabase.from('tours').update({ status }).eq('id', id);
      if (err) throw err;
      await fetchTours();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleTourEdit = (updated) => {
    setTours(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated, profiles: t.profiles } : t));
    setEditingTour(null);
  };

  const saveGuideReview = async (guide, updates, decision) => {
    setBusyId(guide.id);
    setError('');
    try {
      const saved = await persistGuideReview(supabase, guide.id, updates);
      setGuides(current => current.map(item => item.id === saved.id ? saved : item));
      toast.success(decision === 'approve' ? 'Profile approved.' : decision === 'reject' ? 'Profile rejected with reason.' : 'Profile changes saved.');
      return saved;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  const handleReplyUpdate = (id, replyText) => {
    setReviews(prev => prev.map(r => r.id === id ? { ...r, admin_reply: replyText } : r));
  };

  const handleReviewModeration = async (review, decision, reviewText) => {
    setBusyId(review.id);
    setError('');
    try {
      const updates = buildReviewModerationUpdates({
        decision,
        reviewText,
        reviewedBy: profile.id,
      });
      await persistReviewModeration(supabase, review.id, updates);
      await fetchReviews();
      toast.success(
        decision === 'approve'
          ? 'Review approved.'
          : decision === 'reject'
            ? 'Review rejected.'
            : 'Review edits saved.',
      );
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const platformTours = tours.filter(t => t.is_platform_tour);

  const counts = {
    pending:  tours.filter(t => t.status === 'pending_review' || t.status === 'draft').length,
    tours:    tours.length,
    platform: platformTours.length,
    guides:   guides.length,
    comments: reviews.filter(review => (review.status || 'pending') === 'pending').length,
    articles: 0, // ArticlesView manages its own data via useAllArticlesAdmin
  };

  const handlePlatformTourSaved = (saved, isNew) => {
    setTours(prev => {
      if (isNew) return [saved, ...prev];
      return prev.map(t => t.id === saved.id ? { ...t, ...saved, profiles: t.profiles } : t);
    });
  };

  const handlePlatformTourDelete = async (id) => {
    if (!window.confirm('Delete this platform tour? This cannot be undone.')) return;
    setBusyId(id);
    setError('');
    try {
      const { error: err } = await supabase.from('tours').delete().eq('id', id);
      if (err) throw err;
      setTours(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  // ── Loading splash while auth verifies ──
  if (!authChecked || !profile) {
    return (
      <div className="min-h-screen bg-[hsl(222,55%,8%)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[hsl(178,85%,45%)] animate-spin" />
          <p className="text-white/40 text-sm">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // ── Render ──
  const renderSection = () => {
    switch (section) {
      case 'overview':
        return (
          <OverviewView
            tours={tours}
            guides={guides}
            reviews={reviews}
            loading={loadingTours || loadingGuides || loadingReviews}
          />
        );
      case 'pending':
        return (
          <PendingToursView
            tours={tours}
            loading={loadingTours}
            busyId={busyId}
            onApprove={(id) => changeTourStatus(id, 'published')}
            onReject={(id) => changeTourStatus(id, 'rejected')}
            onEdit={setEditingTour}
          />
        );
      case 'tours':
        return (
          <AllToursView
            tours={tours}
            loading={loadingTours}
            busyId={busyId}
            onApprove={(id) => changeTourStatus(id, 'published')}
            onReject={(id) => changeTourStatus(id, 'rejected')}
            onEdit={setEditingTour}
          />
        );
      case 'platform':
        return (
          <PlatformToursView
            tours={platformTours}
            loading={loadingTours}
            busyId={busyId}
            onSaved={handlePlatformTourSaved}
            onDelete={handlePlatformTourDelete}
          />
        );
      case 'guides':
        return (
          <GuidesView
            guides={guides}
            loading={loadingGuides}
            busyId={busyId}
            onReviewProfile={setReviewingGuide}
          />
        );
      case 'comments':
        return (
          <CommentsView
            reviews={reviews}
            loading={loadingReviews}
            busyId={busyId}
            onReply={handleReplyUpdate}
            onModerate={handleReviewModeration}
          />
        );
      case 'chats':
        return <AdminChatMonitor />;
      case 'articles':
        return <ArticlesView profile={profile} />;
      case 'destinations':
        return <HomeDestinationsEditor />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(222,55%,8%)] flex">
      <Sidebar
        section={section}
        onNavigate={setSection}
        counts={counts}
        profile={profile}
        onLogout={handleLogout}
      />

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <ErrorBox message={error} onClose={() => setError('')} />
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            {renderSection()}
          </motion.div>
        </div>
      </main>

      {editingTour && (
        <TourEditModal
          tour={editingTour}
          onSave={handleTourEdit}
          onClose={() => setEditingTour(null)}
        />
      )}
      {reviewingGuide && (
        <GuideProfileReviewModal
          key={reviewingGuide.id}
          guide={reviewingGuide}
          busy={busyId === reviewingGuide.id}
          onClose={() => setReviewingGuide(null)}
          onSave={saveGuideReview}
        />
      )}
    </div>
  );
}
