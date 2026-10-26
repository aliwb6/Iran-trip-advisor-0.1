import {
  useEffect,
  useRef,
  useState } from 'react';
import { useLocation,
  useNavigate,
  useParams } from 'react-router-dom';
import { AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { BreathingGlow as Loader2 } from '@/components/ui/BreathingGlow';
import TripRequestForm from '@/components/profile/TripRequestForm';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/supabaseClient';
import { useI18n } from '@/lib/i18n.jsx';
import { localize } from '@/lib/localize';

export default function DirectTripRequestPage() {
  const { lang } = useI18n();
  const l = (en, fa, ar) => localize(lang, en, fa, ar);
  const { guideId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoadingAuth } = useAuth();

  const [intentId, setIntentId] = useState(null);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');
  const submittedRef = useRef(false);

  useEffect(() => {
    if (isLoadingAuth) return;

    if (!isAuthenticated) {
      navigate('/login', {
        replace: true,
        state: { from: location.pathname },
      });
      return;
    }

    if (!guideId) {
      setError(l('Guide or agency not found.', 'راهنما یا آژانس پیدا نشد.', 'لم يُعثر على المرشد أو الوكالة.'));
      setStarting(false);
      return;
    }

    let mounted = true;

    const begin = async () => {
      setStarting(true);
      setError('');

      const { data, error: rpcError } = await supabase.rpc('begin_direct_trip_request', {
        provider_id: guideId,
      });

      if (!mounted) return;

      if (rpcError) {
        setError(l('Could not start this trip request.', 'شروع ثبت درخواست سفر ممکن نشد.', 'تعذّر بدء طلب الرحلة هذا.'));
        setStarting(false);
        return;
      }

      setIntentId(data);
      setStarting(false);
    };

    begin();
    return () => { mounted = false; };
  }, [guideId, isAuthenticated, isLoadingAuth, location.pathname, navigate]);

  const cancelIntent = async () => {
    if (!intentId || submittedRef.current) return;
    try {
      await supabase.rpc('cancel_direct_trip_request_intent', { intent_id: intentId });
    } catch {
      // The intent expires automatically; navigation should never be blocked.
    }
  };

  const handleClose = async () => {
    if (submittedRef.current) {
      navigate('/profile/requests', { replace: true });
      return;
    }

    await cancelIntent();
    navigate(-1);
  };

  const handleSuccess = () => {
    // The database trigger has already consumed the intent and attached the
    // selected provider to the newly-created trip request.
    submittedRef.current = true;
  };

  if (isLoadingAuth || starting) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          <span className="text-sm">{l('Preparing your trip request…', 'در حال آماده‌سازی درخواست سفر شما…', 'جارٍ إعداد طلب رحلتك…')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <h1 className="font-heading text-xl font-semibold text-foreground">{l('Unable to start request', 'شروع درخواست ممکن نشد', 'تعذّر بدء الطلب')}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            {l('Back', 'بازگشت', 'رجوع')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <TripRequestForm
      isOpen={Boolean(intentId)}
      onClose={handleClose}
      onSuccess={handleSuccess}
    />
  );
}
