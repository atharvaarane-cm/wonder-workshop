// A storyboard frame is "stale" when its brief has been edited since the image
// was generated/uploaded — the picture no longer matches the words, with no
// signal today. We snapshot the brief into `frame.imageBrief` whenever the image
// is set (the UPLOAD_FRAME_IMAGE reducer chokepoint), then compare.
//
// Conservative: only flags when imageBrief is actually present, so legacy frames
// (imaged before this shipped) never show a false "stale" until their next
// regenerate stamps a snapshot.
export function isFrameStale(frame) {
  if (!frame) return false;
  if (!frame.uploadedImage) return false; // no image to be out of date
  if (frame.imageStatus === "generating" || frame.imageStatus === "queued") return false;
  if (typeof frame.imageBrief !== "string") return false; // no snapshot yet
  return (frame.brief || "") !== frame.imageBrief;
}
