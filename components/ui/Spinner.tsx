import { ui } from "@/lib/i18n/ui";

type SpinnerProps = {
  label?: string;
};

export default function Spinner({ label = ui.common.loading }: SpinnerProps) {
  return (
    <div className="spinner-wrap" role="status">
      <div className="spinner-ring" aria-hidden />
      <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
    </div>
  );
}
