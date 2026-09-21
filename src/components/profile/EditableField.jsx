import {
  useState,
  useEffect } from 'react';
import { Pencil,
  Check,
  X,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import { useI18n } from '@/lib/i18n.jsx';

// Inline editable row. View mode shows label + value + pencil icon.
// Clicking the pencil reveals an input (or textarea / select) with save/cancel.
// Pass `onSave(value)` returning a Promise — exit edit mode only if it resolves.
//
// Variants:
//   type="text"      — single-line input (default)
//   type="email"     — email input
//   type="tel"       — phone input
//   type="textarea"  — multi-line, useful for About Me
//   type="select"    — provide `options: [{ value, label }]`
//   type="password"  — masked input
export default function EditableField({
  label,
  value,
  placeholder,
  onSave,
  type = 'text',
  options = [],
  rightSlot = null,
  helperText = '',
  rtlValue = false,
  min,
  max,
}) {
  const { lang, dir } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) setDraft(value ?? '');
  }, [value, editing]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave?.(draft);
      setEditing(false);
    } catch (err) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(value ?? '');
    setError('');
    setEditing(false);
  };

  const renderInput = () => {
    const cls =
      'w-full px-3.5 py-2.5 rounded-xl border border-border/60 bg-background text-foreground text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent transition';

    if (type === 'textarea') {
      return (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className={`${cls} resize-none`}
          autoFocus
          dir={rtlValue ? dir : undefined}
        />
      );
    }
    if (type === 'select') {
      return (
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={`${cls} appearance-none cursor-pointer`}
          autoFocus
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
    return (
      <input
        type={type}
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className={cls}
        autoFocus
        dir={rtlValue ? dir : 'ltr'}
      />
    );
  };

  const displayValue = (() => {
    if (type === 'password') return value ? '••••••••' : '—';
    if (type === 'select') {
      const found = options.find((o) => o.value === value);
      return found?.label || value || '—';
    }
    return value || '—';
  })();

  return (
    <div className="py-4 border-b border-border/30 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-body text-[11px] uppercase tracking-wider text-muted-foreground/80 mb-1">
            {label}
          </p>
          {!editing ? (
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-body text-sm text-foreground" dir={rtlValue ? dir : undefined}>
                {displayValue}
              </p>
              {rightSlot}
            </div>
          ) : (
            <div>
              {renderInput()}
              {helperText && !error && (
                <p className="font-body text-[11px] text-muted-foreground mt-1.5">{helperText}</p>
              )}
              {error && <p className="font-body text-xs text-destructive mt-1.5">{error}</p>}
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold disabled:opacity-60 transition"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {lang === 'fa' ? 'ذخیره' : lang === 'ar' ? 'حفظ' : 'Save'}
                </button>
                <button
                  onClick={cancel}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground text-xs font-medium transition"
                >
                  <X className="w-3.5 h-3.5" />
                  {lang === 'fa' ? 'لغو' : lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          )}
        </div>

        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 w-8 h-8 rounded-lg border border-border/50 text-muted-foreground hover:text-gold hover:border-gold/60 flex items-center justify-center transition"
            aria-label={`Edit ${label}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
