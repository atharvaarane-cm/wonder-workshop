import { useEffect } from "react";
import { AnchoredToastProvider, ToastProvider, toastManager } from "@/components/ui/toast";
import WorkshopV2 from "./v2/Workshop.jsx";
import { purgeLegacyV1Storage } from "./v2/persistence.js";

export default function App() {
  useEffect(() => {
    purgeLegacyV1Storage();
  }, []);

  return (
    <ToastProvider position="top-right">
      <AnchoredToastProvider>
        <ToastEventBridge />
        <WorkshopV2 />
      </AnchoredToastProvider>
    </ToastProvider>
  );
}

function ToastEventBridge() {
  useEffect(() => {
    function onToast(event) {
      const detail = event.detail || {};
      const type = detail.type || detail.kind || "success";
      toastManager.add({
        title: detail.msg || detail.message || "",
        type,
        timeout: detail.ttl || (type === "error" ? 6000 : 3500),
        priority: type === "error" ? "high" : "low",
      });
    }
    window.addEventListener("ww-toast", onToast);
    return () => window.removeEventListener("ww-toast", onToast);
  }, []);

  return null;
}
