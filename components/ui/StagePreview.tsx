import DinoSvg, { CactusSvg } from "@/components/ui/DinoSvg";

type StagePreviewProps = {
  dinoColor?: string;
  tall?: boolean;
};

export default function StagePreview({
  dinoColor = "var(--coral)",
  tall,
}: StagePreviewProps) {
  return (
    <div className={`stage-preview${tall ? " stage-preview-tall" : ""}`} aria-hidden>
      <div className="stage-sun" />
      <div
        className="stage-cloud"
        style={{ top: 14, left: 30, width: 30, height: 14 }}
      />
      <div
        className="stage-cloud"
        style={{ top: 24, right: 50, width: 22, height: 10 }}
      />
      <div className="stage-dino">
        <DinoSvg color={dinoColor} size={56} />
      </div>
      <div className="stage-cactus">
        <CactusSvg size={28} />
      </div>
      <div className="stage-ground" />
    </div>
  );
}
