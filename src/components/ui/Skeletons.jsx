import { BreathingGlow } from '@/components/ui/BreathingGlow';
import { cn } from '@/lib/utils';

function LoaderBlock({ className, label = 'Loading' }) {
  return (
    <div className={cn('flex min-h-[12rem] w-full items-center justify-center', className)}>
      <BreathingGlow label={label} />
    </div>
  );
}

export function TourCardSkeleton({ className }) {
  return <LoaderBlock className={className} label="Loading tour" />;
}

export function TourGridSkeleton({ className }) {
  return <LoaderBlock className={className} label="Loading tours" />;
}

export function TourDetailsSkeleton() {
  return <LoaderBlock className="min-h-[60vh]" label="Loading tour details" />;
}

export function GuideCardSkeleton({ className }) {
  return <LoaderBlock className={className} label="Loading guide" />;
}

export function GuideGridSkeleton({ className }) {
  return <LoaderBlock className={className} label="Loading guides" />;
}

export function ArticleCardSkeleton({ className }) {
  return <LoaderBlock className={className} label="Loading article" />;
}

export function ArticleGridSkeleton({ className }) {
  return <LoaderBlock className={className} label="Loading articles" />;
}

export function DestinationsSkeleton({ className }) {
  return <LoaderBlock className={className} label="Loading destinations" />;
}

export function SearchResultsSkeleton({ className }) {
  return <LoaderBlock className={className} label="Loading search results" />;
}
