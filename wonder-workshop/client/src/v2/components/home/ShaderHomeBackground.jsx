// Isolated so the heavy @shadergradient/react + three stack is code-split into
// its own chunk and only fetched when the user actually selects the "Shader"
// home background (the default is the orange image, so most sessions never
// load this). Lazy-imported by HomeBackground.jsx.
import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";

const SHADER_PRESET = {
  animate: "on",
  bgColor1: "#000000",
  bgColor2: "#000000",
  brightness: 1,
  cAzimuthAngle: 180,
  cDistance: 2.8,
  cPolarAngle: 80,
  cameraZoom: 9.1,
  color1: "#2a0000",
  color2: "#caab47",
  color3: "#212121",
  envPreset: "city",
  grain: "on",
  lightType: "3d",
  positionX: 0,
  positionY: 0,
  positionZ: 0,
  range: "disabled",
  rangeEnd: 40,
  rangeStart: 0,
  reflection: 0.1,
  rotationX: 50,
  rotationY: 0,
  rotationZ: -60,
  shader: "defaults",
  type: "waterPlane",
  uAmplitude: 0,
  uDensity: 1.5,
  uFrequency: 0,
  uSpeed: 0.3,
  uStrength: 1.5,
  uTime: 8,
  wireframe: false,
};

export default function ShaderHomeBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        background: "#090b0e",
      }}
    >
      <ShaderGradientCanvas
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        pixelDensity={1}
        fov={45}
        lazyLoad={false}
      >
        <ShaderGradient {...SHADER_PRESET} />
      </ShaderGradientCanvas>
    </div>
  );
}
