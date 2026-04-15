"use client";

import { useLayoutEffect, useRef, useState } from "react";

export function useMobileFitScale(breakpoint = 820, baseWidth = 560) {
  const frameRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;

    if (!frame || !content || typeof window === "undefined") {
      return undefined;
    }

    const update = () => {
      if (window.innerWidth > breakpoint) {
        setScale(1);
        setHeight(null);
        setReady(true);
        return;
      }

      const availableWidth = frame.clientWidth;
      const naturalHeight = content.offsetHeight;

      if (!availableWidth || !naturalHeight) {
        return;
      }

      const nextScale = Math.min(1, availableWidth / baseWidth);
      setScale(nextScale);
      setHeight(Math.ceil(naturalHeight * nextScale));
      setReady(true);
    };

    update();

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(frame);
    resizeObserver.observe(content);
    window.addEventListener("resize", update);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [baseWidth, breakpoint]);

  return { frameRef, contentRef, scale, height, ready };
}
