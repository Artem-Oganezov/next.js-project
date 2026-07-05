type PanelSkeletonProps = {
  rows?: number;
};

export default function PanelSkeleton({ rows = 4 }: PanelSkeletonProps) {
  return (
    <div className="panel skeleton-panel" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton-row">
          <span className="skeleton-circle" />
          <span className="skeleton-circle skeleton-circle-sm" />
          <span className="skeleton-line" />
          <span className="skeleton-line skeleton-line-short" />
        </div>
      ))}
    </div>
  );
}
