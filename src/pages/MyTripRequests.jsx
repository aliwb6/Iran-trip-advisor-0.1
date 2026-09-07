import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, MapPin, Calendar, Users, MessageCircle,
  RefreshCw, CheckCircle2, Clock, Zap, AlertCircle, Loader2, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../lib/AuthContext';
import {
  getMyTripRequests,
  rebroadcastTripRequest,
  completeTripRequest,
  cancelTripRequest,
} from '../api/tripRequests';
import TripRequestForm from '../components/trips/TripRequestForm';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_CONFIG = {
  open: {
    label: 'Open',
    icon: Zap,
    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  },
  active: {
    label: 'Active',
    icon: Zap,
    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
  proposals_ready: {
    label: 'Proposals ready',
    icon: CheckCircle2,
    classes: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  },
  confirmed: {
    label: 'Guide selected',
    icon: CheckCircle2,
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  booked: {
    label: 'Booked',
    icon: CheckCircle2,
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  expired: {
    label: 'Expired',
    icon: AlertCircle,
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
  cancelled: {
    label: 'Cancelled',
    icon: AlertCircle,
    classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
  closed: {
    label: 'Closed',
    icon: CheckCircle2,
    classes: 'bg-muted text-muted-foreground',
  },
};

const OPEN_REQUEST_STATUSES = new Set(['open', 'active', 'pending', 'proposals_ready']);
const CANCELLABLE_STATUSES = new Set(['open', 'active', 'pending', 'proposals_ready', 'confirmed', 'booked']);

const destinationLabel = (destination) => {
  if (Array.isArray(destination)) return destination.filter(Boolean).join(', ');
  return destination || 'Iran';
};

const travelerCount = (trip) => {
  const adults = Number(trip.adults || 0);
  const children = Number(trip.children || 0);
  const total = adults + children;
  return total > 0 ? total : Number(trip.num_people || 1);
};

const effectiveRequestStatus = (trip) => {
  if (
    OPEN_REQUEST_STATUSES.has(trip.status) &&
    trip.expires_at &&
    new Date(trip.expires_at).getTime() <= Date.now()
  ) {
    return 'expired';
  }
  return trip.status;
};

const canCompleteBookedTrip = (trip) => {
  if (trip.status !== 'booked') return false;
  if (!trip.end_date) return true;
  const end = new Date(`${trip.end_date}T23:59:59`);
  return end.getTime() <= Date.now();
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium font-body ${cfg.classes}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function ProposalProgress({ proposalsCount, maxProposals }) {
  const max = Math.max(1, Number(maxProposals) || 5);
  const count = Math.max(0, Math.min(Number(proposalsCount) || 0, max));
  const percent = Math.round((count / max) * 100);

  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 rounded-full bg-border/50 overflow-hidden" aria-hidden="true">
        <div className="h-full bg-accent transition-all" style={{ width: `${percent}%` }} />
      </div>
      <span className="font-body text-xs text-muted-foreground whitespace-nowrap">
        {count}/{max} proposal{max !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

function GuideSlot({ slot }) {
  const navigate = useNavigate();
  const guideName = slot.guide?.full_name || 'Guide';
  const avatarUrl = slot.guide?.avatar_url;
  const initials = (slot.guide?.full_name || 'G')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const slotStatusLabel = {
    accepted:  { label: 'Proposal received', color: 'text-muted-foreground' },
    chatting:  { label: 'Chatting', color: 'text-accent' },
    selected:  { label: 'Selected — awaiting guide confirmation', color: 'text-emerald-600' },
    finalized: { label: 'Booking confirmed', color: 'text-emerald-600' },
    closed:    { label: 'Closed', color: 'text-muted-foreground' },
  }[slot.status] || { label: slot.status, color: 'text-muted-foreground' };

  if (slot.status === 'rejected') return null;

  return (
    <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-muted/30 border border-border/30">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-accent/20 flex items-center justify-center shrink-0">
          {avatarUrl ? (
            <img decoding="async" loading="lazy" src={avatarUrl} alt={guideName} className="w-full h-full object-cover" />
          ) : (
            <span className="font-body text-xs font-bold text-accent">{initials}</span>
          )}
        </div>
        <div>
          <p className="font-body text-sm font-medium text-foreground">{guideName}</p>
          <p className={`font-body text-xs ${slotStatusLabel.color}`}>{slotStatusLabel.label}</p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => navigate(`/chat/${slot.guide_id}`)}
        className="font-body text-xs rounded-lg h-7 border-border/60 gap-1"
      >
        <MessageCircle className="w-3 h-3" />
        Message
      </Button>
    </div>
  );
}

function TripCard({ trip, onChanged }) {
  const [rebroadcasting, setRebroadcasting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [, refreshExpiry] = useState(0);

  useEffect(() => {
    if (!OPEN_REQUEST_STATUSES.has(trip.status) || !trip.expires_at) return undefined;
    const delay = new Date(trip.expires_at).getTime() - Date.now();
    if (delay <= 0) return undefined;
    const timer = window.setTimeout(() => refreshExpiry(value => value + 1), delay + 50);
    return () => window.clearTimeout(timer);
  }, [trip.expires_at, trip.status]);

  const effectiveStatus = effectiveRequestStatus(trip);
  const startDate = trip.start_date
    ? new Date(trip.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const endDate = trip.end_date
    ? new Date(trip.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const people = travelerCount(trip);
  const activeSlots = (trip.slots || []).filter(slot => slot.status !== 'rejected');
  const canComplete = canCompleteBookedTrip(trip);
  const canCancel = CANCELLABLE_STATUSES.has(trip.status) && effectiveStatus !== 'expired';

  const handleRebroadcast = async () => {
    setRebroadcasting(true);
    try {
      await rebroadcastTripRequest(trip.id);
      toast.success('Your trip request has been re-broadcast to guides!');
      await onChanged();
    } catch (err) {
      toast.error(err.message || 'Failed to re-broadcast.');
    } finally {
      setRebroadcasting(false);
    }
  };

  const handleComplete = async () => {
    if (!window.confirm('Mark this booked trip as completed?')) return;
    setCompleting(true);
    try {
      await completeTripRequest(trip.id);
      toast.success('Trip marked as completed.');
      await onChanged();
    } catch (err) {
      toast.error(err.message || 'Could not complete this trip.');
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this trip request? This will close the active proposal/booking lifecycle.')) return;
    setCancelling(true);
    try {
      await cancelTripRequest(trip.id);
      toast.success('Trip request cancelled.');
      await onChanged();
    } catch (err) {
      toast.error(err.message || 'Could not cancel this trip request.');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm"
    >
      {effectiveStatus === 'completed' && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-body text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Trip completed successfully.
          </span>
        </div>
      )}

      {effectiveStatus === 'confirmed' && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20">
          <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-body text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Your guide was selected. Waiting for the guide or agency to confirm the booking.
          </span>
        </div>
      )}

      {effectiveStatus === 'expired' && trip.status !== 'expired' && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-red-500/10 border-b border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-body text-sm font-medium text-red-700 dark:text-red-400">
            The proposal window has ended. You can re-broadcast this request now.
          </span>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading text-base font-semibold text-foreground leading-snug">
              {trip.title || 'Custom trip request'}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-gold" />
              <span className="font-body text-sm">{destinationLabel(trip.destination)}</span>
            </div>
          </div>
          <StatusBadge status={effectiveStatus} />
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3 font-body text-sm text-muted-foreground">
          {(startDate || endDate) && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              {startDate}{startDate && endDate ? ' → ' : ''}{endDate}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 shrink-0" />
            {people} {people === 1 ? 'person' : 'people'}
          </span>
          {trip.rebroadcast_count > 0 && (
            <span className="flex items-center gap-1 text-xs">
              <RefreshCw className="w-3 h-3 shrink-0" />
              Re-broadcast ×{trip.rebroadcast_count}
            </span>
          )}
        </div>

        <div className="mb-4">
          <ProposalProgress proposalsCount={trip.proposals_count} maxProposals={trip.max_proposals} />
        </div>

        {activeSlots.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="font-body text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Guide proposals
            </p>
            {activeSlots.map(slot => <GuideSlot key={slot.id} slot={slot} />)}
          </div>
        )}

        <div className="space-y-2">
          {effectiveStatus === 'expired' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRebroadcast}
              disabled={rebroadcasting}
              className="w-full font-body text-sm rounded-xl border-dashed border-border/60 gap-2"
            >
              {rebroadcasting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {rebroadcasting ? 'Re-broadcasting…' : 'Re-broadcast to Guides'}
            </Button>
          )}

          {canComplete && (
            <Button
              size="sm"
              onClick={handleComplete}
              disabled={completing}
              className="w-full font-body text-sm rounded-xl gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {completing ? 'Completing…' : 'Mark trip as completed'}
            </Button>
          )}

          {trip.status === 'booked' && !canComplete && trip.end_date && (
            <p className="text-xs text-muted-foreground text-center">
              You can mark this trip completed after {endDate}.
            </p>
          )}

          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={cancelling}
              className="w-full font-body text-sm rounded-xl gap-2 border-red-500/30 text-red-600 hover:bg-red-500/5"
            >
              {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              {cancelling ? 'Cancelling…' : 'Cancel trip request'}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-36" />
          <div className="flex gap-3">
            <Skeleton className="h-1.5 w-24 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MyTripRequests() {
  const { user, isAuthenticated, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) navigate('/login');
  }, [isLoadingAuth, isAuthenticated, navigate]);

  const loadTrips = useCallback(async () => {
    if (!user?.id) return;
    try {
      setError(null);
      const data = await getMyTripRequests(user.id);
      setTrips(data || []);
    } catch (err) {
      setError(err.message || 'Failed to load your trips.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) loadTrips();
  }, [user?.id, loadTrips]);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-background pt-20 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20 pb-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <p className="font-body text-xs uppercase tracking-widest text-gold mb-1">Travel Planning</p>
          <h1 className="font-heading text-3xl font-bold text-foreground">My Trip Requests</h1>
          <p className="font-body text-muted-foreground mt-1.5">
            Track your trip requests and communicate with matched guides.
          </p>
        </div>

        {error ? (
          <div className="text-center py-16">
            <p className="font-body text-sm text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={loadTrips} className="font-body">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        ) : loading ? (
          <LoadingSkeleton />
        ) : trips.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-foreground mb-1">No trip requests yet</h3>
            <p className="font-body text-sm text-muted-foreground max-w-xs mx-auto mb-6">
              Create your first trip request and get matched with expert local guides.
            </p>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-accent hover:bg-accent/90 text-white font-body font-semibold rounded-xl gap-2"
            >
              <Plus className="w-4 h-4" />
              New Trip Request
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {trips.map(trip => <TripCard key={trip.id} trip={trip} onChanged={loadTrips} />)}
          </div>
        )}
      </div>

      {trips.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setDialogOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-accent text-white font-body font-semibold text-sm shadow-lg shadow-accent/30 hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Trip Request
          </motion.button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-semibold">New Trip Request</DialogTitle>
            <p className="font-body text-sm text-muted-foreground">
              Fill in your preferences and we'll match you with local guides.
            </p>
          </DialogHeader>
          <TripRequestForm onClose={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
