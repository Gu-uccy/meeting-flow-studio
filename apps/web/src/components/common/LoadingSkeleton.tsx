type LoadingSkeletonProps = {
  lines?: number;
  className?: string;
};

export function LoadingSkeleton({ lines = 3, className = "" }: LoadingSkeletonProps) {
  return (
    <div className={`loading-skeleton${className ? ` ${className}` : ""}`} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <div
          className="loading-skeleton__line"
          key={index}
          style={{ width: `${Math.max(42, 92 - index * 14)}%` }}
        />
      ))}
    </div>
  );
}

export function MeetingCardSkeleton() {
  return (
    <div className="meeting-card meeting-card--skeleton" aria-hidden="true">
      <div className="loading-skeleton__line loading-skeleton__line--short" />
      <div className="loading-skeleton__line loading-skeleton__line--title" />
      <div className="loading-skeleton__line" />
      <div className="loading-skeleton__line loading-skeleton__line--meta" />
    </div>
  );
}
