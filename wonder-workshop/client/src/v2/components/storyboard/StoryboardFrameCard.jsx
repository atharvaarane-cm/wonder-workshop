import { memo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TAP_SPRING = { type: "spring", stiffness: 420, damping: 30, mass: 0.6 };
const HOVER_SCALE = 1.012;
const TAP_SCALE = 0.985;

const FILM = [
  "linear-gradient(145deg, #161618 0%, #252528 35%, #161618 100%)",
  "linear-gradient(180deg, #121214 0%, #1e1e22 50%, #121214 100%)",
  "linear-gradient(200deg, #101016 0%, #1a1a24 50%, #101016 100%)",
  "linear-gradient(160deg, #101016 0%, #1c1c28 40%, #101016 100%)",
  "linear-gradient(175deg, #161618 0%, #252528 50%, #161618 100%)",
  "linear-gradient(140deg, #101016 0%, #1a1a24 30%, #161618 75%, #121214 100%)",
];

const MOVEMENT_TYPES = [
  { value: "static", label: "Static" },
  { value: "pan", label: "Pan" },
  { value: "track", label: "Track" },
  { value: "crane", label: "Crane" },
  { value: "handheld", label: "Handheld" },
  { value: "steadicam", label: "Steadicam" },
];

function ShimmerOverlay({ label = "Generating..." }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center bg-[length:200%_100%] animate-[shimmer_1.5s_infinite_linear]"
      style={{ backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 100%)" }}
    >
      <span className="rounded-full bg-black/40 px-2 py-[3px] font-semibold text-[9px] uppercase tracking-[0.06em] text-[color:var(--warm-50)] backdrop-blur-md">
        {label}
      </span>
    </div>
  );
}

function FrameDuration({ duration, onChange }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(duration || "");

  useEffect(() => {
    setValue(duration || "");
  }, [duration]);

  function commit() {
    setEditing(false);
    const v = (value || "").trim();
    if (!v) {
      onChange?.("3s");
      return;
    }
    const normalized = /^\d/.test(v) && !/s$/i.test(v) ? `${v}s` : v;
    if (normalized !== duration) onChange?.(normalized);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
            setValue(duration || "");
          }
        }}
        onClick={e => e.stopPropagation()}
        className="w-[42px] rounded-md border border-[#363636] bg-[#191919]/80 px-1 py-0.5 text-center text-xs font-medium leading-5 text-white/70 outline-none"
      />
    );
  }

  return (
    <span
      onClick={e => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Click to edit shot duration"
      className="cursor-pointer whitespace-nowrap text-xs font-medium leading-5 text-white/60"
    >
      {duration || "-"}
    </span>
  );
}

function StoryboardFrameCardComponent({
  frame,
  index,
  data,
  aspectCSS = "2.39/1",
  selected,
  highlighted,
  isDragSrc,
  dispatch,
  onRetry,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDragEnd,
  onDrop,
  onClick,
  renderMentions,
}) {
  const [hovered, setHovered] = useState(false);
  const loc = data.locations.find(l => l.id === frame.locationId);

  const handleImageError = () => {
    dispatch({ type: "CLEAR_FRAME_IMAGE", frameId: frame.id, status: "error" });
  };

  const frameCardClassName = cn(
    "relative flex h-full cursor-pointer flex-col overflow-hidden rounded-[12px] border border-[#363636] bg-[#202020] text-white",
    "shadow-[0px_-1px_0px_0px_rgba(255,255,255,0.06),0px_1px_2px_0px_rgba(0,0,0,0.42)] transition-[border-color,box-shadow,opacity]",
    isDragSrc ? "cursor-grabbing opacity-[0.15]" : "cursor-pointer opacity-100",
    selected && "border-[#43a3fd] ring-1 ring-[#43a3fd]/60",
    highlighted && "ring-1 ring-[#43a3fd]/40 animate-[highlightPulse_1.5s_ease]",
    hovered && !selected && "border-white/25",
  );
  const movementLabel = MOVEMENT_TYPES.find(m => m.value === frame.movement)?.label || "Static";

  return (
    <Card
      render={<motion.div />}
      className={frameCardClassName}
      layout
      layoutId={`frame-${frame.id}`}
      draggable
      onDragStart={e => onDragStart(e, frame.id)}
      onDragOver={e => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={isDragSrc ? undefined : { y: -2, scale: HOVER_SCALE }}
      whileTap={isDragSrc ? undefined : { scale: TAP_SCALE }}
      transition={TAP_SPRING}
    >
      <div className="pointer-events-none absolute -left-px -top-[3px] h-14 w-[calc(100%+2px)] overflow-hidden">
        <div className="absolute inset-0 bg-[rgba(90,90,90,0.5)]" />
        <img
          alt=""
          src="/figma-assets/storyboard-card-header-gradient.png"
          className="absolute inset-0 h-full w-full object-cover opacity-10"
        />
      </div>

      <div className="relative z-[1] flex h-[38px] shrink-0 items-center justify-between gap-3 px-[18px]">
        <span className="shrink-0 text-base font-semibold leading-5 text-white [font-feature-settings:'zero']">
          {frame.number}
        </span>
        <span className="flex min-w-0 items-center gap-1 text-xs font-medium leading-5 text-white/60">
          <span className="shrink-0 font-['SF_Pro'] font-medium">{`\u{1002D2}`}</span>
          <span className="truncate">{loc?.name || "-"}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1 text-xs font-medium leading-5 text-white/60">
          <span className="shrink-0 font-['SF_Pro'] font-medium">{`\u{1008AF}`}</span>
          <span className="truncate">{frame.shotType} {"\xB7"} {movementLabel}</span>
        </span>
        <FrameDuration
          duration={frame.duration}
          onChange={v => dispatch?.({ type: "UPDATE_FRAME", frameId: frame.id, field: "duration", value: v })}
        />
      </div>

      <div className="relative mx-[-1px] flex flex-1 flex-col overflow-hidden rounded-[12px] border border-[#363636] bg-[#191919] shadow-[inset_0px_0px_0px_2px_rgba(255,255,255,0.15)]">
        <div
          className="relative shrink-0 overflow-hidden"
          style={{ aspectRatio: aspectCSS }}
        >
          <div
            className="absolute inset-0"
            style={{ background: frame.uploadedImage ? "transparent" : FILM[index % FILM.length] }}
          />
          {frame.uploadedImage && (
            <img
              src={frame.uploadedImage}
              alt=""
              onError={handleImageError}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {!frame.uploadedImage && (
            <div
              className="absolute inset-0"
              style={{ background: "radial-gradient(ellipse 70% 80% at center, transparent 0%, rgba(0,0,0,0.4) 100%)" }}
            />
          )}
          {frame.imageStatus === "generating" && <ShimmerOverlay />}
          {!frame.uploadedImage && frame.imageStatus !== "generating" && frame.imageStatus !== "error" && onRetry && (
            <div className="absolute inset-0 z-[3] flex items-center justify-center bg-black/20 p-2.5">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onRetry(frame.id);
                }}
                className="cursor-pointer rounded-full border border-white/40 bg-white/10 px-3 py-1 text-[11px] font-medium tracking-[0.04em] text-white backdrop-blur-md"
              >
                Generate
              </button>
            </div>
          )}
          {frame.imageStatus === "error" && !frame.uploadedImage && (
            <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-2 bg-black/40 p-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-white/90">
                Generation failed
              </div>
              {onRetry && (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onRetry(frame.id);
                  }}
                  className="cursor-pointer rounded-full border border-white/40 bg-white/10 px-3 py-1 text-[11px] font-medium tracking-[0.04em] text-white"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </div>

        <div className="relative min-h-[91px] flex-1 overflow-hidden px-[clamp(14px,5.4%,23px)] pb-[clamp(12px,3.2%,18px)] pt-[clamp(12px,3.2%,18px)]">
          <div className="absolute inset-0 bg-[#191919]" />
          {frame.uploadedImage && (
            <img
              alt=""
              src={frame.uploadedImage}
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-80 blur-[25px]"
              onError={handleImageError}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(0deg, rgba(0,0,0,0.74) 0%, rgba(0,0,0,0.733) 6.2698%, rgba(0,0,0,0.714) 12.54%, rgba(0,0,0,0.68) 18.81%, rgba(0,0,0,0.63) 25.079%, rgba(0,0,0,0.57) 31.349%, rgba(0,0,0,0.494) 37.619%, rgba(0,0,0,0.41) 43.889%, rgba(0,0,0,0.33) 50.159%, rgba(0,0,0,0.247) 56.429%, rgba(0,0,0,0.173) 62.698%, rgba(0,0,0,0.11) 68.968%, rgba(0,0,0,0.06) 75.238%, rgba(0,0,0,0) 94.048%)",
            }}
          />
          <div className="relative line-clamp-3 text-sm font-medium leading-[24.39px] text-white">
            {renderMentions ? renderMentions(frame.brief, data, { variant: "figmaCard" }) : frame.brief}
          </div>
        </div>
      </div>
    </Card>
  );
}

export const StoryboardFrameCard = memo(StoryboardFrameCardComponent);
