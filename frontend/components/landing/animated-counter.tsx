"use client";

import { memo, useRef, useEffect, useState } from "react";
import { useInView } from "framer-motion";

interface AnimatedCounterProps {
  target: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  label: string;
}

const AnimatedCounter = memo(function AnimatedCounter({
  target,
  prefix = "",
  suffix = "",
  duration = 2000,
  label,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let start = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);

      setCount(current);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }, [isInView, target, duration]);

  const formatted =
    count >= 1000000
      ? `${(count / 1000000).toFixed(1)}M`
      : count >= 1000
        ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`
        : count.toLocaleString();

  return (
    <div ref={ref} className="rounded-md bg-gray-50 p-8 flex flex-col justify-center shadow-[inset_0_1px_4px_rgba(0,0,0,0.025)]">
      <div className="space-y-3">
        <div
          className="text-[2.5rem] md:text-[3rem] text-[#1a1a1a]"
          style={{ letterSpacing: "-0.02em", fontWeight: 400 }}
        >
          {prefix}{formatted}{suffix}
        </div>
        <p className="text-base" style={{ color: "rgba(51, 51, 51, 0.8)", lineHeight: 1.6 }}>
          {label}
        </p>
      </div>
    </div>
  );
});

export default AnimatedCounter;
