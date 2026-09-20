// @ts-nocheck
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Edit2, Check, X as XIcon, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// ── Brand tokens (mirrors AIAssistant.jsx) ────────────────────────────────────
const C = {
  turq:     '#0D8B85',
  turqSoft: '#3FC7C1',
  turqDeep: '#0A6864',
  teal:     '#1A4A4A',
  white:    '#FFFFFF',
  muted:    '#7A8C8C',
  ink:      '#0F2A2A',
};

// ── Mini Aria avatar ──────────────────────────────────────────────────────────
function AriaMark({ size = 32 }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 30% 28%, ${C.turqSoft}, ${C.turq} 60%, ${C.turqDeep})`,
          boxShadow: `0 4px 12px ${C.turq}40`,
        }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <Sparkles className="text-white" style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} />
      </div>
    </div>
  );
}

// ── ChatMessage ───────────────────────────────────────────────────────────────
//
// Props:
//   msg         – { id, role, content, edited, editedAt, cards? }
//   convId      – active conversation ID (passed to onEdit)
//   onEdit      – (convId, msgId, newText) => void  — only called when text changed
//   loading     – bool, disables the Edit button while the bot is replying
//   lang        – 'en' | 'fa' | 'ar'
//   renderCards – React node rendered below the assistant bubble (card grid, etc.)
//
export function ChatMessage({ msg, convId, onEdit, loading, lang, renderCards }) {
  const isUser = msg.role === 'user';

  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content);
  const textareaRef = useRef(null);

  // Keep draft in sync if the message was replaced from outside (e.g. edit confirmed)
  useEffect(() => {
    if (!isEditing) setEditText(msg.content);
  }, [msg.content, isEditing]);

  // Auto-size + focus the textarea when edit mode opens
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 240) + 'px';
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = editText.trim();
    if (!trimmed) return;
    // Only call onEdit when something actually changed
    if (trimmed !== msg.content.trim()) {
      onEdit(convId, msg.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(msg.content);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleTextareaChange = (e) => {
    setEditText(e.target.value);
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 240) + 'px';
  };

  // ── Assistant bubble ──────────────────────────────────────────────────────
  if (!isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-3"
      >
        <div className="flex w-full items-end gap-3 justify-start">
          <AriaMark size={32} />
          <div className="max-w-[84%] sm:max-w-[78%] flex flex-col items-start">
            <span
              className="mb-1 px-1 text-[11px] font-medium tracking-wide"
              style={{ color: C.muted }}
            >
              Aria
            </span>
            <div
              className="relative rounded-3xl rounded-bl-md px-4 py-3 sm:px-5 sm:py-3.5 shadow-sm"
              style={{ background: C.white, color: C.ink, border: `1px solid ${C.muted}20` }}
            >
              <ReactMarkdown className="font-body text-sm prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 leading-relaxed">
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Card grid passed from parent (keeps TourCard/GuideCard in AIAssistant) */}
        {renderCards && (
          <div className="ml-11">
            {renderCards}
          </div>
        )}
      </motion.div>
    );
  }

  // ── User bubble: edit mode ────────────────────────────────────────────────
  if (isEditing) {
    return (
      <motion.div
        key="editing"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
        className="flex w-full justify-end"
      >
        <div className="max-w-[85%] w-full flex flex-col gap-2">
          {/* Label */}
          <p
            className="text-[10.5px] font-semibold uppercase tracking-[0.1em] self-end"
            style={{ color: C.turq }}
          >
            {lang === 'fa' ? 'ویرایش پیام' : lang === 'ar' ? 'تعديل الرسالة' : 'Edit message'}
          </p>

          {/* Editable area */}
          <div
            className="rounded-3xl rounded-br-md px-4 py-3.5"
            style={{
              background: `${C.turq}10`,
              border: `2px solid ${C.turq}50`,
            }}
          >
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              dir="auto"
              className="w-full resize-none bg-transparent outline-none text-sm leading-relaxed"
              style={{ color: C.teal, minWidth: 200, overflow: 'hidden' }}
              placeholder={
                lang === 'fa' ? 'پیام خود را ویرایش کنید…'
                : lang === 'ar' ? 'عدّل رسالتك…'
                : 'Edit your message…'
              }
            />
          </div>

          {/* Action row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px]" style={{ color: `${C.muted}BB` }}>
              {lang === 'fa'
                ? 'Ctrl+Enter برای ذخیره · Esc برای انصراف'
                : lang === 'ar'
                ? 'Ctrl+Enter للحفظ · Esc للإلغاء'
                : 'Ctrl+Enter to save · Esc to cancel'}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all hover:bg-gray-100 active:scale-95"
                style={{ color: C.muted, border: `1px solid ${C.muted}30` }}
              >
                <XIcon className="h-3.5 w-3.5" />
                {lang === 'fa' ? 'انصراف' : lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleSave}
                disabled={!editText.trim()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                style={{
                  background: `linear-gradient(135deg, ${C.turq}, ${C.turqDeep})`,
                  color: C.white,
                  boxShadow: `0 4px 12px ${C.turq}35`,
                }}
              >
                <Check className="h-3.5 w-3.5" />
                {lang === 'fa' ? 'ذخیره و ارسال' : lang === 'ar' ? 'حفظ وإرسال' : 'Save & Send'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── User bubble: default view ─────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="group flex w-full items-end gap-3 justify-end"
    >
      <div className="max-w-[84%] sm:max-w-[78%] flex flex-col items-end">
        {/*
          Edit button:
          – Mobile (< lg): always visible so touch users can tap it
          – Desktop (lg+): hidden, revealed on hover of the .group parent
        */}
        <div
          className={[
            'mb-1.5 flex items-center gap-1 transition-opacity duration-150',
            loading
              ? 'opacity-0 pointer-events-none'
              : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100',
          ].join(' ')}
        >
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all hover:opacity-80 active:scale-95"
            style={{ background: `${C.muted}15`, color: C.muted }}
            aria-label={lang === 'fa' ? 'ویرایش پیام' : lang === 'ar' ? 'تعديل الرسالة' : 'Edit message'}
          >
            <Edit2 className="h-3 w-3" />
            <span>
              {lang === 'fa' ? 'ویرایش' : lang === 'ar' ? 'تعديل' : 'Edit'}
            </span>
          </button>
        </div>

        {/* Bubble */}
        <div
          className="relative rounded-3xl rounded-br-md px-4 py-3 sm:px-5 sm:py-3.5 shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${C.turq} 0%, ${C.turqDeep} 100%)`,
            color: '#FFFFFF',
            boxShadow: `0 6px 18px ${C.turq}30`,
          }}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
        </div>

        {/* Edited badge */}
        {msg.edited && (
          <span
            className="mt-1 px-1 text-[10px] select-none"
            style={{ color: `${C.muted}90` }}
          >
            {lang === 'fa' ? '(ویرایش‌شده)' : lang === 'ar' ? '(محرَّر)' : '(edited)'}
          </span>
        )}
      </div>
    </motion.div>
  );
}
