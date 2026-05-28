// PPTX export for v2. Lazy-loads pptxgenjs (~800 KB) so the initial
// bundle stays small and the cost is only paid when the user clicks
// Export PPTX. Reads from v2's data shape.

const SLIDE_W = 13.333; // 16:9 master, inches
const SLIDE_H = 7.5;

function fitDuration(frames) {
  if (!Array.isArray(frames) || frames.length === 0) return "";
  let sum = 0;
  for (const f of frames) {
    const n = parseFloat(String(f.duration || "").match(/[\d.]+/)?.[0] || "0");
    if (!isNaN(n)) sum += n;
  }
  return sum > 0 ? `${sum % 1 === 0 ? sum : sum.toFixed(1)}s` : "";
}

async function loadPptx() {
  const mod = await import("pptxgenjs");
  return mod.default || mod;
}

export async function exportPptx(data) {
  const Pptx = await loadPptx();
  const pres = new Pptx();
  pres.layout = "LAYOUT_WIDE";
  pres.title = data?.meta?.title || "Workshop Project";

  // --- Title slide --------------------------------------------------
  const title = pres.addSlide();
  title.background = { color: "0E0D0B" };
  title.addText(data?.meta?.title || "Untitled", {
    x: 0.5, y: 2.5, w: SLIDE_W - 1, h: 1.2,
    fontSize: 44, fontFace: "Inter", bold: true, color: "F4F2EE", align: "left",
  });
  const subParts = [];
  if (data?.meta?.client) subParts.push(data.meta.client);
  if (data?.meta?.format) subParts.push(`Target :${data.meta.format}`);
  if (data?.meta?.aspect) subParts.push(data.meta.aspect);
  const total = fitDuration(data?.frames);
  if (total) subParts.push(`${total} total`);
  title.addText(subParts.join("  ·  "), {
    x: 0.5, y: 3.9, w: SLIDE_W - 1, h: 0.4,
    fontSize: 14, fontFace: "Inter", color: "AAAAAA",
  });
  if (data?.brand?.logo) {
    try {
      title.addImage({ path: data.brand.logo, x: SLIDE_W - 2.2, y: 0.5, w: 1.6, h: 1.6 });
    } catch {}
  }
  title.addText("Wonder · AI", {
    x: 0.5, y: SLIDE_H - 0.6, w: 2, h: 0.3,
    fontSize: 9, fontFace: "Inter", color: "555555",
  });

  // --- Treatment slide ---------------------------------------------
  if (data?.meta?.treatment) {
    const t = pres.addSlide();
    t.background = { color: "0E0D0B" };
    t.addText("TREATMENT", {
      x: 0.5, y: 0.4, w: SLIDE_W - 1, h: 0.3,
      fontSize: 10, fontFace: "Inter", bold: true, color: "777777", charSpacing: 4,
    });
    t.addText(data.meta.treatment, {
      x: 0.5, y: 0.9, w: SLIDE_W - 1, h: SLIDE_H - 1.4,
      fontSize: 14, fontFace: "Inter", color: "DDDDDD", paraSpaceAfter: 6, valign: "top",
    });
  }

  // --- Storyboard frames: 2 frames per slide ----------------------
  const frames = data?.frames || [];
  for (let i = 0; i < frames.length; i += 2) {
    const slide = pres.addSlide();
    slide.background = { color: "0E0D0B" };
    slide.addText("STORYBOARD", {
      x: 0.5, y: 0.3, w: 4, h: 0.3,
      fontSize: 9, fontFace: "Inter", bold: true, color: "777777", charSpacing: 4,
    });
    const slot = (offsetX, frame) => {
      if (!frame) return;
      const x = offsetX;
      const y = 1.1;
      const w = (SLIDE_W - 1.5) / 2;
      const h = 3.6;
      slide.addText(`${frame.number}  ${frame.shotType || ""}  ·  ${frame.camera || ""}`, {
        x, y: y - 0.4, w, h: 0.3,
        fontSize: 10, fontFace: "Inter", bold: true, color: "BBBBBB",
      });
      if (frame.uploadedImage) {
        try { slide.addImage({ path: frame.uploadedImage, x, y, w, h, sizing: { type: "contain", w, h } }); }
        catch {}
      } else {
        slide.addShape("rect", { x, y, w, h, fill: { color: "1A1A1E" }, line: { color: "2A2A30" } });
        slide.addText("(no image)", { x, y: y + h/2 - 0.2, w, h: 0.4, fontSize: 12, fontFace: "Inter", color: "555555", align: "center" });
      }
      slide.addText(frame.brief || "", {
        x, y: y + h + 0.1, w, h: 1.6,
        fontSize: 10, fontFace: "Inter", color: "CCCCCC", valign: "top",
      });
      if (frame.duration) {
        slide.addText(frame.duration, {
          x: x + w - 0.7, y, w: 0.7, h: 0.35,
          fontSize: 10, fontFace: "Inter", bold: true, color: "F4F2EE",
          fill: { color: "000000", transparency: 30 }, align: "center", valign: "middle",
        });
      }
    };
    slot(0.5, frames[i]);
    slot(0.5 + (SLIDE_W - 1.5) / 2 + 0.5, frames[i + 1]);
  }

  // --- Talent slide ------------------------------------------------
  if ((data?.talent || []).length > 0) {
    const s = pres.addSlide();
    s.background = { color: "0E0D0B" };
    s.addText("TALENT", {
      x: 0.5, y: 0.3, w: 4, h: 0.3,
      fontSize: 9, fontFace: "Inter", bold: true, color: "777777", charSpacing: 4,
    });
    const cols = Math.min(data.talent.length, 4);
    const cellW = (SLIDE_W - 1) / cols;
    data.talent.slice(0, 4).forEach((t, i) => {
      const x = 0.5 + i * cellW;
      const y = 1;
      const headshot = t.headshot || t.headshots?.front;
      if (headshot) {
        try { s.addImage({ path: headshot, x, y, w: cellW - 0.2, h: cellW - 0.2, sizing: { type: "cover", w: cellW - 0.2, h: cellW - 0.2 } }); }
        catch {}
      }
      s.addText(t.name || "Unnamed", {
        x, y: y + cellW, w: cellW - 0.2, h: 0.4,
        fontSize: 14, fontFace: "Inter", bold: true, color: "F4F2EE",
      });
      s.addText(t.role || "", {
        x, y: y + cellW + 0.4, w: cellW - 0.2, h: 0.3,
        fontSize: 9, fontFace: "Inter", color: "AAAAAA", charSpacing: 2,
      });
      if (t.note) {
        s.addText(t.note, {
          x, y: y + cellW + 0.75, w: cellW - 0.2, h: 1.6,
          fontSize: 9, fontFace: "Inter", color: "CCCCCC", valign: "top",
        });
      }
    });
  }

  // --- Locations slide --------------------------------------------
  if ((data?.locations || []).length > 0) {
    const s = pres.addSlide();
    s.background = { color: "0E0D0B" };
    s.addText("LOCATIONS", {
      x: 0.5, y: 0.3, w: 4, h: 0.3,
      fontSize: 9, fontFace: "Inter", bold: true, color: "777777", charSpacing: 4,
    });
    const cols = Math.min(data.locations.length, 3);
    const cellW = (SLIDE_W - 1) / cols;
    data.locations.slice(0, 3).forEach((l, i) => {
      const x = 0.5 + i * cellW;
      const y = 1;
      const cellH = cellW * 9 / 16;
      const img = l.generatedImage || l.referenceImage;
      if (img) {
        try { s.addImage({ path: img, x, y, w: cellW - 0.2, h: cellH, sizing: { type: "cover", w: cellW - 0.2, h: cellH } }); }
        catch {}
      }
      s.addText(l.name || "", { x, y: y + cellH + 0.1, w: cellW - 0.2, h: 0.4, fontSize: 14, fontFace: "Inter", bold: true, color: "F4F2EE" });
      if (l.note) {
        s.addText(l.note, { x, y: y + cellH + 0.55, w: cellW - 0.2, h: 1.4, fontSize: 9, fontFace: "Inter", color: "CCCCCC", valign: "top" });
      }
    });
  }

  // --- Elements slide ----------------------------------------------
  if ((data?.products || []).length > 0) {
    const s = pres.addSlide();
    s.background = { color: "0E0D0B" };
    s.addText("ELEMENTS", {
      x: 0.5, y: 0.3, w: 4, h: 0.3,
      fontSize: 9, fontFace: "Inter", bold: true, color: "777777", charSpacing: 4,
    });
    const cols = Math.min(data.products.length, 4);
    const cellW = (SLIDE_W - 1) / cols;
    data.products.slice(0, 4).forEach((p, i) => {
      const x = 0.5 + i * cellW;
      const y = 1;
      if (p.referenceImage) {
        try { s.addImage({ path: p.referenceImage, x, y, w: cellW - 0.2, h: cellW - 0.2, sizing: { type: "cover", w: cellW - 0.2, h: cellW - 0.2 } }); }
        catch {}
      }
      s.addText(p.name || "", { x, y: y + cellW, w: cellW - 0.2, h: 0.4, fontSize: 14, fontFace: "Inter", bold: true, color: "F4F2EE" });
      s.addText(p.category || "", { x, y: y + cellW + 0.4, w: cellW - 0.2, h: 0.3, fontSize: 9, fontFace: "Inter", color: "AAAAAA" });
    });
  }

  const filename = `${(data?.meta?.title || "workshop").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.pptx`;
  await pres.writeFile({ fileName: filename });
  return filename;
}
