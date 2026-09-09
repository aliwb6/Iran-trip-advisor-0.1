import { useEffect, useState } from 'react';
import { BadgeCheck, ExternalLink, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/supabaseClient';

const copy = {
  en: {
    title: 'License',
    loading: 'Loading verified license…',
    unavailable: 'The verified license preview is temporarily unavailable.',
    open: 'View license',
    verifiedGuide: 'Verified Guide',
    verifiedAgency: 'Verified Agency',
  },
  fa: {
    title: 'مجوز',
    loading: 'در حال بارگذاری مجوز تأییدشده…',
    unavailable: 'پیش‌نمایش مجوز تأییدشده موقتاً در دسترس نیست.',
    open: 'مشاهده مجوز',
    verifiedGuide: 'راهنمای تأییدشده',
    verifiedAgency: 'آژانس تأییدشده',
  },
  ar: {
    title: 'الرخصة',
    loading: 'جارٍ تحميل الرخصة الموثقة…',
    unavailable: 'معاينة الرخصة الموثقة غير متاحة مؤقتًا.',
    open: 'عرض الرخصة',
    verifiedGuide: 'مرشد موثق',
    verifiedAgency: 'وكالة موثقة',
  },
};

const isExternalUrl = (value) => /^https?:\/\//i.test(value || '');
const isPdfPath = (value) => {
  const clean = String(value || '').split(/[?#]/, 1)[0];
  try {
    return decodeURIComponent(clean).toLowerCase().endsWith('.pdf');
  } catch {
    return clean.toLowerCase().endsWith('.pdf');
  }
};

export default function PublicLicenseCard({ profile, lang = 'en', className = '' }) {
  const labels = copy[lang] || copy.en;
  const licensePath = typeof profile?.public_license_path === 'string'
    ? profile.public_license_path.trim()
    : '';
  const eligible = Boolean(
    profile?.is_approved
      && profile?.license_status === 'verified'
      && licensePath
  );

  const [resolvedUrl, setResolvedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolvedUrl('');
    setPreviewError(false);

    if (!eligible) {
      setLoading(false);
      return () => { cancelled = true; };
    }

    const resolveLicense = async () => {
      setLoading(true);

      try {
        if (isExternalUrl(licensePath)) {
          if (!cancelled) setResolvedUrl(licensePath);
          return;
        }

        const { data, error } = await supabase.storage
          .from('licenses')
          .createSignedUrl(licensePath, 600);

        if (error || !data?.signedUrl) throw error || new Error('Missing signed URL');
        if (!cancelled) setResolvedUrl(data.signedUrl);
      } catch {
        if (!cancelled) setPreviewError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    resolveLicense();
    return () => { cancelled = true; };
  }, [eligible, licensePath]);

  if (!eligible) return null;

  const providerLabel = profile.role === 'agency'
    ? labels.verifiedAgency
    : labels.verifiedGuide;
  const pdf = isPdfPath(licensePath);
  const previewTitle = `${profile?.full_name || providerLabel} — ${labels.title}`;

  return (
    <section className={`${className} overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm`}>
      <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold">
            <FileText className="h-5 w-5" />
          </div>
          <h2 className="font-heading text-lg font-semibold text-foreground">{labels.title}</h2>
        </div>
        <BadgeCheck className="h-5 w-5 flex-shrink-0 text-emerald-500" aria-label={providerLabel} />
      </div>

      <div className="p-4">
        <div className="relative flex min-h-[18rem] items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted/25 sm:min-h-[22rem] xl:min-h-[20rem]">
          {loading && (
            <div className="flex flex-col items-center gap-3 px-5 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-gold" />
              <p className="font-body text-xs">{labels.loading}</p>
            </div>
          )}

          {!loading && previewError && (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 text-gold">
                <ImageIcon className="h-5 w-5" />
              </div>
              <p className="max-w-[15rem] font-body text-xs leading-relaxed text-muted-foreground">
                {labels.unavailable}
              </p>
            </div>
          )}

          {!loading && !previewError && resolvedUrl && pdf && (
            <>
              <div className="flex min-h-[18rem] w-full flex-col items-center justify-center gap-4 px-5 text-center sm:hidden">
                <FileText className="h-12 w-12 text-gold" />
                <a
                  href={resolvedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gold/30 px-4 py-2.5 font-body text-sm font-semibold text-gold transition hover:bg-gold/5"
                >
                  {labels.open}
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <iframe
                src={`${resolvedUrl}#toolbar=0&navpanes=0`}
                title={previewTitle}
                className="hidden h-[22rem] w-full bg-white sm:block xl:h-[20rem]"
              />
            </>
          )}

          {!loading && !previewError && resolvedUrl && !pdf && (
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-[18rem] w-full items-center justify-center sm:h-[22rem] xl:h-[20rem]"
              aria-label={labels.open}
            >
              <img
                src={resolvedUrl}
                alt={previewTitle}
                loading="lazy"
                decoding="async"
                className="max-h-full max-w-full object-contain p-2"
                onError={() => setPreviewError(true)}
              />
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/50 px-4 py-3.5">
        <div className="inline-flex items-center gap-2 font-body text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <BadgeCheck className="h-4 w-4" />
          <span>{providerLabel}</span>
        </div>

        {resolvedUrl && !previewError && (
          <a
            href={resolvedUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 py-2 font-body text-xs font-semibold text-gold transition hover:bg-gold/5"
          >
            {labels.open}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </section>
  );
}
