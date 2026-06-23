import { Component, lazy, Suspense } from "react";
import { ImageIcon, WavesIcon } from "lucide-react";

// The WebGL shader background pulls in three + @shadergradient (~hundreds of KB).
// The default home background is the orange image, so lazy-load the shader so its
// chunk is only fetched when a user actually switches to "Shader" mode.
const ShaderHomeBackground = lazy(() => import("./ShaderHomeBackground.jsx"));

// The shader background is a WebGL canvas — on machines/projectors without
// usable WebGL (common at venues) it can fail to init and leave the landing
// blank. Detect support up front, and catch any init error at runtime, so we
// always fall back to the static "classic" background instead of a blank page.
function supportsWebGL() {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
  } catch {
    return false;
  }
}

export const HOME_BACKGROUND_STORAGE_KEY = "ww-home-background";
export const HOME_BACKGROUND_OPTIONS = {
  shader: "shader",
  classic: "classic",
  orange: "orange",
};

const CLASSIC_HOME_BG = "/landing-bg/wonder-w.png";
const ORANGE_HOME_BG = "/landing-bg/home-orange.jpg";

export function normalizeHomeBackground(value) {
  return Object.values(HOME_BACKGROUND_OPTIONS).includes(value)
    ? value
    : HOME_BACKGROUND_OPTIONS.shader;
}

// Falls back to the classic background if the shader subtree throws while
// mounting (e.g. WebGL context creation fails on the host).
class ShaderErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn("[HomeBackground] shader failed — falling back to classic", err); }
  render() { return this.state.failed ? <ClassicHomeBackground /> : this.props.children; }
}

export function HomeBackground({ mode = HOME_BACKGROUND_OPTIONS.shader }) {
  const normalizedMode = normalizeHomeBackground(mode);

  // The orange "homescreen" backdrop (Figma) is its own look — a full-bleed image
  // kept vivid, with only a soft vignette (the dark glass card supplies its own
  // contrast), so it skips the heavy darkening overlays shader/classic use.
  if (normalizedMode === HOME_BACKGROUND_OPTIONS.orange) {
    return <OrangeHomeBackground />;
  }

  // Honor the shader choice only where WebGL actually works; otherwise classic.
  const useShader = normalizedMode === HOME_BACKGROUND_OPTIONS.shader && supportsWebGL();

  return (
    <>
      {useShader ? (
        <ShaderErrorBoundary>
          <Suspense fallback={<ClassicHomeBackground />}>
            <ShaderHomeBackground />
          </Suspense>
        </ShaderErrorBoundary>
      ) : (
        <ClassicHomeBackground />
      )}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(10,10,10,0.38) 0%, rgba(10,10,10,0.62) 54%, rgba(10,10,10,0.96) 100%)",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 50% 47%, rgba(10, 17, 26, 0) 0%, rgba(10, 10, 10, 0.26) 46%, rgba(10, 10, 10, 0.74) 100%)",
        }}
      />
    </>
  );
}

function ClassicHomeBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        backgroundImage: `url(${CLASSIC_HOME_BG})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        opacity: 0.55,
      }}
    />
  );
}

function OrangeHomeBackground() {
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          backgroundImage: `url(${ORANGE_HOME_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 60% 52% at 50% 58%, rgba(8,5,3,0.32) 0%, rgba(8,5,3,0) 72%)",
        }}
      />
    </>
  );
}

export function HomeBackgroundSwitch({ value, onChange }) {
  const options = [
    { value: HOME_BACKGROUND_OPTIONS.shader, label: "Shader", icon: WavesIcon },
    { value: HOME_BACKGROUND_OPTIONS.classic, label: "Classic", icon: ImageIcon },
  ];

  return (
    <div
      aria-label="Home background"
      role="group"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        padding: 3,
        borderRadius: 9,
        background: "rgba(10,10,12,0.48)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      {options.map(option => {
        const Icon = option.icon;
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            title={`Use ${option.label.toLowerCase()} background`}
            onClick={() => onChange(option.value)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 28,
              padding: "0 9px",
              borderRadius: 7,
              color: selected ? "#f7f3ee" : "rgba(247,243,238,0.58)",
              background: selected ? "rgba(255,255,255,0.12)" : "transparent",
              border: "none",
              fontFamily: "var(--f)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              transition: "background 0.14s ease, color 0.14s ease",
            }}
          >
            <Icon aria-hidden="true" size={14} strokeWidth={1.8} />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
