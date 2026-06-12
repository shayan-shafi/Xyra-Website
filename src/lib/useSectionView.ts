"use client";

import { useEffect, useRef } from "react";
import { trackOncePerSession } from "@/lib/analytics";

// Fires `section_view` exactly once per session the first time the ref'd
// element crosses 25% visibility. Returns a ref to attach to the section root.
export function useSectionView<T extends Element = HTMLElement>(sectionName: string) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof IntersectionObserver === "undefined") return;
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            trackOncePerSession(`section:${sectionName}`, "section_view", {
              section_name: sectionName,
            });
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.25 },
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [sectionName]);

  return ref;
}
