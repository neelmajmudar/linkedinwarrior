"use client";

import { memo } from "react";
import { motion } from "framer-motion";

const toneItems = [
  { label: "Rage-bait", value: 50, color: "text-gray-800" },
  { label: "Thought-provoking", value: 35, color: "text-gray-500" },
  { label: "Inspiring", value: 15, color: "text-gray-400" },
];

const floatingLabels = [
  { text: "Rage Bait", x: "-10%", y: "30%", opacity: 0.25, delay: 0.6 },
  { text: "Thought-provoking", x: "-5%", y: "50%", opacity: 0.2, delay: 0.8 },
];

const PostToneAnalysis = memo(function PostToneAnalysis() {
  return (
    <div className="relative w-full h-full min-h-[320px] flex items-center justify-center overflow-hidden">
      {/* Light blue gradient background */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background:
            "linear-gradient(145deg, #e8f0f8 0%, #dce8f4 40%, #d0e0f0 100%)",
        }}
      />

      {/* Floating background labels */}
      {floatingLabels.map((label) => (
        <motion.span
          key={label.text}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: label.opacity }}
          transition={{ duration: 1, delay: label.delay }}
          viewport={{ once: true }}
          className="absolute font-mono text-[10px] text-gray-400 italic"
          style={{ left: label.x, top: label.y }}
        >
          {label.text}
        </motion.span>
      ))}

      {/* LinkedIn post card */}
      <motion.div
        initial={{ opacity: 0, y: 20, rotateY: -5 }}
        whileInView={{ opacity: 1, y: 0, rotateY: -5 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        viewport={{ once: true }}
        className="relative bg-white rounded-lg shadow-xl border border-gray-100 w-[55%] max-w-[240px] p-4 z-10"
        style={{ transform: "perspective(800px) rotateY(-5deg)" }}
      >
        {/* LinkedIn icon */}
        <svg className="w-5 h-5 text-[#0a66c2] mb-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>

        {/* Post text lines */}
        <div className="space-y-2">
          <p className="text-[7px] leading-relaxed text-gray-600">
            Every &quot;AI startup&quot; right now is the same: a fancy wrapper, a new font, and a ChatGPT API key. No data, no moat, no reason to exist.
          </p>
          <p className="text-[7px] leading-relaxed text-gray-600">
            The real question isn&apos;t what can GPT do — it&apos;s what can&apos;t it see?
          </p>
          <p className="text-[7px] leading-relaxed text-gray-600">
            Build something that would still matter if GPT vanished tomorrow.
          </p>
        </div>

        {/* Placeholder image area */}
        <div className="mt-3 w-full h-16 rounded bg-gradient-to-br from-amber-100 to-orange-50 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-white/60" />
        </div>
      </motion.div>

      {/* Tone analysis widget */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        viewport={{ once: true }}
        className="absolute right-[8%] top-[15%] bg-white/95 backdrop-blur rounded-lg shadow-lg border border-gray-100 p-3 w-[140px] z-20"
      >
        {/* Window dots */}
        <div className="flex items-center gap-1 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        </div>

        {/* Tone bars */}
        <div className="space-y-2">
          {toneItems.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.7 + i * 0.15 }}
              viewport={{ once: true }}
            >
              <div className="flex items-baseline justify-between mb-0.5">
                <span className={`text-[8px] font-mono ${item.color}`}>
                  {item.value}% {item.label}
                </span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gray-300"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${item.value}%` }}
                  transition={{ duration: 0.8, delay: 0.9 + i * 0.15 }}
                  viewport={{ once: true }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
});

export default PostToneAnalysis;
