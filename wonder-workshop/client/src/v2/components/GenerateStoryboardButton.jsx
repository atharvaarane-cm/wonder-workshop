import { useState } from "react";
import matrixLoaderUrl from "../../assets/matrix-loader-2.svg";

function ButtonIcon({ src, size = 18 }) {
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{
        display: "block",
        width: size,
        height: size,
        flexShrink: 0,
        objectFit: "contain",
      }}
    />
  );
}

export function GenerateStoryboardButton({ onClick, generating = false }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%", padding: "6px 0" }}>
      <style>{`
        @keyframes generateButtonLiquidGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes generateButtonGrainShift {
          0% { transform: translate(0, 0); }
          10% { transform: translate(-5%, -5%); }
          20% { transform: translate(-10%, 5%); }
          30% { transform: translate(5%, -10%); }
          40% { transform: translate(-5%, 15%); }
          50% { transform: translate(-10%, 5%); }
          60% { transform: translate(15%, 0); }
          70% { transform: translate(0, 10%); }
          80% { transform: translate(-15%, 0); }
          90% { transform: translate(10%, 5%); }
          100% { transform: translate(5%, 0); }
        }
      `}</style>

      <div
        style={{
          position: "absolute",
          inset: "2px -2px",
          borderRadius: 16,
          zIndex: 0,
          backgroundImage:
            "linear-gradient(135deg, #1197f6 0%, #3d6ef8 24%, #8a43ff 42%, #f20fd0 58%, #ff72a8 76%, #cfff16 100%)",
          backgroundSize: "300% 300%",
          animation: "generateButtonLiquidGradient 18s ease infinite",
          filter: "blur(6px)",
          opacity: hovered ? 0.9 : 0.6,
          transition: "opacity 0.5s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "4px 2px",
          borderRadius: 16,
          zIndex: 0,
          backgroundImage:
            "linear-gradient(225deg, #b98cff 0%, #ff5a00 28%, #ffb51c 52%, #f7ff37 74%, #d6ff12 100%)",
          backgroundSize: "350% 350%",
          animation:
            "generateButtonLiquidGradient 24s ease-in-out infinite reverse",
          filter: "blur(10px)",
          opacity: hovered ? 0.6 : 0.3,
          transition: "opacity 0.5s ease",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "-2px -4px",
          borderRadius: 20,
          zIndex: 0,
          backgroundImage:
            "radial-gradient(ellipse at 24% 48%, rgba(20,150,246,0.48), transparent 68%), radial-gradient(ellipse at 44% 62%, rgba(242,15,208,0.42), transparent 70%), radial-gradient(ellipse at 78% 58%, rgba(207,255,22,0.36), transparent 72%)",
          backgroundSize: "200% 200%",
          animation: "generateButtonLiquidGradient 20s ease infinite",
          filter: "blur(14px)",
          opacity: hovered ? 0.5 : 0.25,
          transition: "opacity 0.5s ease",
        }}
      />

      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          padding: "16px 0",
          fontFamily: "var(--f)",
          fontSize: 17,
          fontWeight: 500,
          letterSpacing: "-0.01em",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 14,
          cursor: "pointer",
          outline: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          color: hovered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)",
          backgroundColor: "#181818",
          backgroundImage:
            "linear-gradient(92deg, rgba(66, 159, 214, 0.18) 3.61%, rgba(119, 98, 231, 0.18) 24.14%, rgba(164, 94, 225, 0.18) 39.21%, rgba(203, 79, 203, 0.18) 56.02%, rgba(255, 53, 152, 0.18) 70.65%, rgba(237, 113, 128, 0.18) 85.72%, rgba(233, 136, 109, 0.18) 100%)",
          backgroundSize: "100% 100%",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: hovered
            ? "0px -1px 0px rgba(255,255,255,0.08), 0px 2px 8px rgba(0,0,0,0.46), inset 0px 1px 0px 1px rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.06)"
            : "0px -1px 0px rgba(255, 255, 255, 0.06), 0px 1px 2px rgba(0, 0, 0, 0.42), inset 0px 1px 0px 1px rgba(255, 255, 255, 0.043)",
          transition: "all 0.4s cubic-bezier(0.22,1,0.36,1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 14,
            pointerEvents: "none",
            opacity: 0.04,
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence baseFrequency='0.7' numOctaves='4' type='fractalNoise'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")",
            backgroundSize: "128px",
            animation: "generateButtonGrainShift 8s steps(10) infinite",
            mixBlendMode: "overlay",
          }}
        />
        <ButtonIcon src={matrixLoaderUrl} size={18} />
        {generating ? "Generating brief..." : "Generate Storyboard"}
      </button>
    </div>
  );
}
