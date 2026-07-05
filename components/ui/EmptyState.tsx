import DinoSvg from "@/components/ui/DinoSvg";

type EmptyStateProps = {
  message: string;
  dinoColor?: string;
};

export default function EmptyState({
  message,
  dinoColor = "var(--coral)",
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <DinoSvg color={dinoColor} size={48} />
      <p>{message}</p>
    </div>
  );
}
