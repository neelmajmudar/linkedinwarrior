"use client";

import { memo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";

const audiences = [
  "Growth Hackers",
  "SaaS Founders",
  "B2B Startups",
  "GTM Leaders",
  "Dev Tool Makers",
  "Content Creators",
];

const ScrollingAudience = memo(function ScrollingAudience() {
  const [index, setIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { margin: "-50px" });

  useEffect(() => {
    if (!isInView) return; // pause interval when off-screen
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % audiences.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [isInView]);

  const current = index;
  const prev = (index - 1 + audiences.length) % audiences.length;
  const next = (index + 1) % audiences.length;

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[280px] flex items-center justify-center overflow-hidden">
      {/* White background */}
      <div className="absolute inset-0 rounded-2xl bg-white" />

      {/* Top and bottom fade masks */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-white to-transparent z-10 rounded-t-2xl" />
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent z-10 rounded-b-2xl" />

      {/* Rotating text container */}
      <div className="relative z-0 flex flex-col items-center justify-center gap-3 h-[200px]">
        {/* Previous item — fading out above */}
        <span className="text-2xl md:text-3xl font-semibold text-gray-300 tracking-tight leading-none select-none">
          {audiences[prev]}
        </span>

        {/* Current item — active center */}
        <AnimatePresence mode="wait">
          <motion.span
            key={audiences[current]}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
            className="text-3xl md:text-4xl font-bold text-gray-800 tracking-tight leading-none select-none"
          >
            {audiences[current]}
          </motion.span>
        </AnimatePresence>

        {/* Next item — faded below */}
        <span className="text-xl md:text-2xl font-semibold text-gray-200 tracking-tight leading-none select-none">
          {audiences[next]}
        </span>
      </div>
    </div>
  );
});

export default ScrollingAudience;
