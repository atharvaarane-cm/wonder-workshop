import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

// Standalone Vitest config — intentionally does NOT load the app's Vite plugins
// (react, tailwind). The pure-logic suites (reducer, prompt assembly, persistence)
// import plain .js modules, so we keep the test pipeline minimal and fast. If we
// ever test .jsx React components, add @vitejs/plugin-react here.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.js"],
    include: ["src/**/*.{test,spec}.{js,jsx}"],
  },
});
