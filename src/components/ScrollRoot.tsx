"use client";

import { useEffect, useRef } from "react";

export default function ScrollRoot({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const apply = () => {
      const vv = window.visualViewport;
      const top = vv?.offsetTop ?? 0;
      const height = Math.round(vv?.height ?? window.innerHeight);
      el.style.position = "fixed";
      el.style.left = "0";
      el.style.right = "0";
      el.style.top = `${top}px`;
      el.style.height = `${Math.max(height, 200)}px`;
      el.style.overflow = "hidden";
      el.style.display = "flex";
      el.style.flexDirection = "column";
      (el.style as any).webkitOverflowScrolling = "touch";
    };

    apply();
    window.visualViewport?.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      window.visualViewport?.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return (
    <div ref={ref} id="scroll-root">
      {children}
    </div>
  );
}
