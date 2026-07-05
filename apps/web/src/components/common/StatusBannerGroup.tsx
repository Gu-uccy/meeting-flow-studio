import { StatusBanner } from "./StatusBanner";

type StatusBannerItem = {
  id: string;
  error: string;
  feedback: string;
};

type StatusBannerGroupProps = {
  items: StatusBannerItem[];
};

export function StatusBannerGroup({ items }: StatusBannerGroupProps) {
  const visibleItems = items.filter((item) => item.error || item.feedback);

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="status-banner-group" aria-live="polite">
      {visibleItems.map((item) => (
        <StatusBanner error={item.error} feedback={item.feedback} key={item.id} />
      ))}
    </div>
  );
}
