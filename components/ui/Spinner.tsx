type SpinnerProps = {
  label?: string;
};

export default function Spinner({ label = "Загрузка…" }: SpinnerProps) {
  return (
    <div className="flex flex-col items-center gap-3 text-[#535353]" role="status">
      <div
        className="h-8 w-8 rounded-full border-2 border-[#d0d0d0] border-t-[#535353] animate-spin"
        aria-hidden
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
