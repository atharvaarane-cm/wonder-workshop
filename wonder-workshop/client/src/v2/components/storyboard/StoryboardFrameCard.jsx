import { memo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";

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
    <div style={{
      position: "absolute", inset: 0, zIndex: 3,
      background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 100%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite linear",
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none",
    }}>
      <span style={{
        fontFamily: "var(--f)", fontSize: 9, fontWeight: 600,
        color: "var(--warm-50)", letterSpacing: "0.06em",
        textTransform: "uppercase",
        background: "rgba(0,0,0,0.4)", padding: "3px 8px", borderRadius: 999,
        backdropFilter: "blur(6px)",
      }}>{label}</span>
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
        style={{
          width: 42, fontFamily: "var(--f)", fontSize: 9, fontWeight: 600,
          color: "var(--warm-40)", textAlign: "center",
          background: "var(--warm-08)", border: "1px solid var(--warm-12)",
          borderRadius: 4, padding: "2px 4px", outline: "none",
          letterSpacing: "0.04em",
        }}
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
      style={{
        fontFamily: "var(--f)", fontSize: 9, fontWeight: 600,
        color: "var(--warm-30)", letterSpacing: "0.06em",
        padding: "2px 6px", borderRadius: 4, cursor: "pointer",
        background: "var(--warm-04)", border: "1px solid var(--warm-06)",
      }}
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

  const frameCardClassName = [
    "overflow-hidden rounded-lg transition-colors",
    selected ? "ring-1 ring-ring/50" : "",
    highlighted ? "ring-1 ring-ring/30" : "",
    hovered ? "border-ring/40" : "",
  ].filter(Boolean).join(" ");

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
      style={{
        cursor: isDragSrc ? "grabbing" : "pointer",
        opacity: isDragSrc ? 0.15 : 1,
        animation: highlighted ? "highlightPulse 1.5s ease" : "none",
        border: "1px solid #ff2b2b",
      }}
    >
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "6px 10px",
        borderBottom: "1px solid var(--warm-04)",
      }}>
        <span style={{ fontFamily: "var(--f)", fontSize: 10, fontWeight: 600, color: "var(--warm-35)", letterSpacing: "0.04em" }}>
          {frame.number}
        </span>
        <span style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 400, color: "var(--warm-20)", letterSpacing: "0.04em" }}>
          {frame.shotType} {"\xB7"} {MOVEMENT_TYPES.find(m => m.value === frame.movement)?.label || "Static"}
        </span>
      </div>

      <div style={{ aspectRatio: aspectCSS, background: frame.uploadedImage ? "transparent" : FILM[index % FILM.length], position: "relative", overflow: "hidden" }}>
        {frame.uploadedImage && (
          <img
            src={frame.uploadedImage}
            alt=""
            onError={handleImageError}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {!frame.uploadedImage && (
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 80% at center, transparent 0%, rgba(0,0,0,0.4) 100%)" }} />
        )}
        {frame.imageStatus === "generating" && <ShimmerOverlay />}
        {frame.imageStatus === "error" && !frame.uploadedImage && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 3,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 8, padding: 10,
            background: "rgba(0,0,0,0.42)",
          }}>
            <div style={{
              fontFamily: "var(--f)", fontSize: 10, fontWeight: 600,
              color: "rgba(255,255,255,0.92)", letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
              Generation failed
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onRetry(frame.id);
                }}
                style={{
                  fontFamily: "var(--f)", fontSize: 11, fontWeight: 500,
                  color: "#fff", background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.4)", borderRadius: 999,
                  padding: "4px 12px", cursor: "pointer", letterSpacing: "0.04em",
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "5px 10px",
        borderTop: "1px solid var(--warm-04)",
      }}>
        <span style={{ fontFamily: "var(--f)", fontSize: 9, fontWeight: 400, color: "var(--warm-20)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {loc?.name || "-"}
        </span>
        <FrameDuration
          duration={frame.duration}
          onChange={v => dispatch?.({ type: "UPDATE_FRAME", frameId: frame.id, field: "duration", value: v })}
        />
      </div>

      <div style={{ padding: "8px 10px 10px" }}>
        <div style={{ fontFamily: "var(--f)", fontSize: 11, fontWeight: 300, color: "var(--warm-35)", lineHeight: 1.7, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {renderMentions ? renderMentions(frame.brief, data) : frame.brief}
        </div>
      </div>
    </Card>
  );
}

export const StoryboardFrameCard = memo(StoryboardFrameCardComponent);
