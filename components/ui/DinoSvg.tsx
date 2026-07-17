import { darkenColor } from "@/game/theme";

type DinoSvgProps = {
  color?: string;
  size?: number;
  className?: string;
};

export default function DinoSvg({
  color = "var(--coral)",
  size = 56,
  className,
}: DinoSvgProps) {
  const legColor = darkenColor(color);

  return (
    <svg
      viewBox="0 0 56 56"
      fill="none"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <rect x="14" y="14" width="28" height="26" rx="10" fill={color} />
      <rect x="30" y="2" width="16" height="16" rx="8" fill={color} />
      <circle cx="40" cy="9" r="2.2" fill="#3b2b4a" />
      <rect x="6" y="22" width="14" height="10" rx="6" fill={color} />
      <rect x="18" y="38" width="9" height="14" rx="4" fill={legColor} />
      <rect x="32" y="38" width="9" height="14" rx="4" fill={legColor} />
      <path
        d="M40 18 q8 -2 6 8"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function CactusSvg({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 28 38"
      fill="none"
      width={size}
      height={Math.round(size * 1.36)}
      className={className}
      aria-hidden
    >
      <rect x="10" y="2" width="8" height="34" rx="4" fill="var(--violet)" />
      <rect x="0" y="12" width="10" height="7" rx="3.5" fill="var(--violet)" />
      <rect x="18" y="18" width="10" height="7" rx="3.5" fill="var(--violet)" />
    </svg>
  );
}
