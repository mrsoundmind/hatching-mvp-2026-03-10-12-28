// Landing v2 — scroll reveal hook.
//
// One IntersectionObserver per element, disconnected after firing. Adds
// .is-visible, which the CSS in landing-v2.css transitions on. Elements are
// revealed immediately when the user prefers reduced motion, so nothing is
// ever hidden behind an animation that will not play.

import { useEffect, useRef, useState } from "react";

export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -60px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible, className: visible ? "lv2-reveal is-visible" : "lv2-reveal" };
}
