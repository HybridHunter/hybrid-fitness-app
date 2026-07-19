/*
 * FeedVideo — social-feed video that autoplays (muted) when it scrolls into
 * view and pauses when it leaves. Controls stay available for sound/seek.
 */
import { useRef, useEffect } from "react";

function cleanDataUrl(v) {
  if (!v || !v.startsWith("data:")) return v;
  const i = v.indexOf(";base64,");
  if (i === -1) return v;
  const mime = v.slice(5, i).split(";")[0].split(",")[0].trim();
  return `data:${mime};base64,` + v.slice(i + 8);
}

export default function FeedVideo({ src, style = {} }) {
  src = cleanDataUrl(src);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            el.play().catch(() => {});
          } else {
            el.pause();
          }
        }
      },
      { threshold: [0, 0.5, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      controls
      preload="metadata"
      onLoadedMetadata={(e) => { try { e.target.currentTime = 0.01; } catch {} }}
      style={style}
    />
  );
}
