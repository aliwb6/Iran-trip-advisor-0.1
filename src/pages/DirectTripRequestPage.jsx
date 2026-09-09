import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import TripRequestForm from '@/components/profile/TripRequestForm';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/supabaseClient';

export default function DirectTripRequestPage() {
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
      setError('Guide or agency not found.');
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
        setError(rpcError.message || 'Could not start this trip request.');
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
          <span className="text-sm">Preparing your trip request…</span>
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
          <h1 className="font-heading text-xl font-semibold text-foreground">Unable to start request</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
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
