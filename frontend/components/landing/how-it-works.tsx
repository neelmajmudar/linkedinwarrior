"use client";

import { memo, useRef, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";

/* ─── Shared metallic gradient defs ─── */
function MetallicDefs({ id }: { id: string }) {
  return (
    <defs>
      {/* Rose-gold metallic gradient */}
      <linearGradient id={`${id}-metal`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#d4a88c" />
        <stop offset="35%" stopColor="#b07a5b" />
        <stop offset="60%" stopColor="#c9956e" />
        <stop offset="100%" stopColor="#a06a4a" />
      </linearGradient>
      {/* Lighter accent gradient */}
      <linearGradient id={`${id}-accent`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#e8d5c8" />
        <stop offset="50%" stopColor="#d4b8a4" />
        <stop offset="100%" stopColor="#c6a08a" />
      </linearGradient>
      {/* Soft fill for shapes */}
      <linearGradient id={`${id}-fill`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#f0e6de" />
        <stop offset="100%" stopColor="#e4d4c8" />
      </linearGradient>
      {/* Metallic sheen highlight */}
      <linearGradient id={`${id}-sheen`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
        <stop offset="50%" stopColor="rgba(255,255,255,0)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
      </linearGradient>
      {/* Drop shadow */}
      <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#8b5e3c" floodOpacity="0.15" />
      </filter>
    </defs>
  );
}

function VoiceProfileIcon() {
  const id = "vp";
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <MetallicDefs id={id} />
      {/* Person head */}
      <circle cx="22" cy="16" r="7" fill={`url(#${id}-fill)`} stroke={`url(#${id}-metal)`} strokeWidth="1.8" filter={`url(#${id}-shadow)`} />
      {/* Person body arc */}
      <path
        d="M10 40c0-7.18 5.82-13 13-13s13 5.82 13 13"
        fill={`url(#${id}-fill)`}
        stroke={`url(#${id}-metal)`}
        strokeWidth="1.8"
        strokeLinecap="round"
        filter={`url(#${id}-shadow)`}
      />
      {/* Metallic highlight on head */}
      <ellipse cx="20" cy="14" rx="3" ry="2.5" fill={`url(#${id}-sheen)`} />
      {/* Sound waves — animated */}
      <motion.path
        d="M38 14c2.2 2.5 3.5 5.8 3.5 9.5s-1.3 7-3.5 9.5"
        stroke={`url(#${id}-accent)`}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        viewport={{ once: true }}
      />
      <motion.path
        d="M43 10c3.2 3.8 5 8.5 5 13.5s-1.8 9.7-5 13.5"
        stroke={`url(#${id}-accent)`}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
        initial={{ pathLength: 0, opacity: 0 }}
        whileInView={{ pathLength: 1, opacity: 0.5 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        viewport={{ once: true }}
      />
      {/* Left equalizer bars */}
      {[{ x: 6, h: 10, delay: 0.2 }, { x: 3, h: 16, delay: 0.35 }].map((bar, i) => (
        <motion.rect
          key={i}
          x={bar.x}
          y={24 - bar.h / 2}
          width="1.8"
          height={bar.h}
          rx="0.9"
          fill={`url(#${id}-metal)`}
          opacity={0.6 - i * 0.15}
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          transition={{ duration: 0.4, delay: bar.delay }}
          viewport={{ once: true }}
          style={{ transformOrigin: `${bar.x + 0.9}px 24px` }}
        />
      ))}
    </svg>
  );
}

function GenerateRefineIcon() {
  const id = "gr";
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <MetallicDefs id={id} />
      {/* Document body with fill */}
      <rect
        x="8" y="4" width="24" height="34" rx="4"
        fill={`url(#${id}-fill)`}
        stroke={`url(#${id}-metal)`}
        strokeWidth="1.8"
        filter={`url(#${id}-shadow)`}
      />
      {/* Metallic sheen on document */}
      <rect x="10" y="5" width="10" height="32" rx="3" fill={`url(#${id}-sheen)`} />
      {/* Text lines — staggered draw */}
      {[
        { x2: 27, y: 14, delay: 0.25 },
        { x2: 23, y: 19, delay: 0.35 },
        { x2: 26, y: 24, delay: 0.45 },
        { x2: 20, y: 29, delay: 0.55 },
      ].map((line, i) => (
        <motion.line
          key={i}
          x1="14" y1={line.y} x2={line.x2} y2={line.y}
          stroke={`url(#${id}-accent)`}
          strokeWidth="1.8"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 0.8 }}
          transition={{ duration: 0.4, delay: line.delay }}
          viewport={{ once: true }}
        />
      ))}
      {/* AI magic wand — slides in */}
      <motion.g
        initial={{ opacity: 0, x: 6, y: 6 }}
        whileInView={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        viewport={{ once: true }}
      >
        {/* Wand body */}
        <line x1="35" y1="26" x2="46" y2="14" stroke={`url(#${id}-metal)`} strokeWidth="2.2" strokeLinecap="round" />
        {/* Wand tip glow */}
        <circle cx="47" cy="13" r="2.5" fill={`url(#${id}-metal)`} filter={`url(#${id}-shadow)`} />
        <circle cx="47" cy="13" r="1.2" fill="white" opacity="0.6" />
        {/* Sparkle stars */}
        <motion.g animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }}>
          <path d="M40 9l0.6-1.8L42.2 8l-1.6 0.6L40 10.4l-0.6-1.8L37.8 8l1.6-0.6Z" fill={`url(#${id}-metal)`} />
        </motion.g>
        <motion.g animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}>
          <path d="M44 20l0.5-1.4L45.9 19.2l-1.4 0.5L44 21.2l-0.5-1.4L42.1 19.2l1.4-0.5Z" fill={`url(#${id}-accent)`} />
        </motion.g>
        <motion.g animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 2.5, repeat: Infinity, delay: 1 }}>
          <path d="M37 16l0.4-1.2L38.6 15.3l-1.2 0.4L37 17l-0.4-1.2L35.4 15.3l1.2-0.4Z" fill={`url(#${id}-accent)`} />
        </motion.g>
      </motion.g>
      {/* Blinking cursor */}
      <motion.line
        x1="22" y1="29" x2="22" y2="33"
        stroke={`url(#${id}-metal)`}
        strokeWidth="1.5"
        strokeLinecap="round"
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    </svg>
  );
}

function ScheduleEngageIcon() {
  const id = "se";
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <MetallicDefs id={id} />
      {/* Calendar body */}
      <rect
        x="4" y="10" width="32" height="32" rx="5"
        fill={`url(#${id}-fill)`}
        stroke={`url(#${id}-metal)`}
        strokeWidth="1.8"
        filter={`url(#${id}-shadow)`}
      />
      {/* Metallic sheen */}
      <rect x="5" y="10" width="14" height="31" rx="4" fill={`url(#${id}-sheen)`} />
      {/* Header bar */}
      <rect x="4" y="10" width="32" height="10" rx="5" fill={`url(#${id}-accent)`} opacity="0.35" />
      <line x1="4" y1="20" x2="36" y2="20" stroke={`url(#${id}-metal)`} strokeWidth="0.8" opacity="0.5" />
      {/* Calendar hooks */}
      <rect x="13" y="6" width="2.5" height="8" rx="1.25" fill={`url(#${id}-metal)`} filter={`url(#${id}-shadow)`} />
      <rect x="24.5" y="6" width="2.5" height="8" rx="1.25" fill={`url(#${id}-metal)`} filter={`url(#${id}-shadow)`} />
      {/* Metallic scheduled dots — animated pop-in */}
      {[
        { cx: 13, cy: 26, r: 2.5, delay: 0.3 },
        { cx: 20, cy: 26, r: 2.5, delay: 0.4 },
        { cx: 27, cy: 26, r: 2.5, delay: 0.5 },
        { cx: 13, cy: 34, r: 2.5, delay: 0.6 },
        { cx: 20, cy: 34, r: 2.5, delay: 0.7 },
        { cx: 27, cy: 34, r: 2.5, delay: 0.8 },
      ].map((dot, i) => (
        <motion.circle
          key={i}
          cx={dot.cx} cy={dot.cy} r={dot.r}
          fill={`url(#${id}-metal)`}
          opacity={0.35 + (i % 3) * 0.2}
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          transition={{ duration: 0.3, delay: dot.delay, type: "spring", stiffness: 400 }}
          viewport={{ once: true }}
        />
      ))}
      {/* Send arrow with metallic fill */}
      <motion.g
        initial={{ opacity: 0, x: -5 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.7, type: "spring" }}
        viewport={{ once: true }}
      >
        <path
          d="M38 34L48 26L38 18V23.5H34V28.5H38V34Z"
          fill={`url(#${id}-metal)`}
          filter={`url(#${id}-shadow)`}
        />
        {/* Arrow highlight */}
        <path d="M38 19L47 26L38 22V19Z" fill={`url(#${id}-sheen)`} />
        {/* Engagement ripples */}
        <motion.circle cx="48" cy="26" r="3" stroke={`url(#${id}-accent)`} strokeWidth="1" fill="none"
          initial={{ scale: 0.8, opacity: 0 }}
          whileInView={{ scale: 2, opacity: [0.5, 0] }}
          transition={{ duration: 1.5, delay: 1.2, repeat: Infinity }}
          viewport={{ once: true }}
        />
      </motion.g>
    </svg>
  );
}

interface Step {
  icon: ReactNode;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    icon: <VoiceProfileIcon />,
    title: "1. Build Your Voice Profile",
    description:
      "Connect your LinkedIn. We analyze your past posts, writing style, and audience to create a unique AI voice model that captures how you actually communicate.",
  },
  {
    icon: <GenerateRefineIcon />,
    title: "2. Generate & Refine",
    description:
      "Tell us your topic — or let the AI suggest trending themes in your niche. Get drafts in seconds that sound like you wrote them. Edit, polish, or approve as-is.",
  },
  {
    icon: <ScheduleEngageIcon />,
    title: "3. Schedule & Engage",
    description:
      "Schedule posts for optimal times. Enable auto-engagement to comment thoughtfully on relevant posts in your niche. Watch your network grow while you focus on your business.",
  },
];

const HowItWorks = memo(function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section className="w-full px-8 md:px-16 lg:px-24 py-24 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex flex-col gap-1 md:gap-3 mb-12 md:mb-20"
        >
          <h2 className="font-normal text-3xl md:text-5xl tracking-[-0.02em] text-[#1a1a1a] text-center">
            How It Works
          </h2>
          <p className="text-center text-base md:text-lg text-gray-500 mx-auto max-w-[500px]">
            Three steps to LinkedIn growth on autopilot.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{
                duration: 0.6,
                delay: 0.15 + i * 0.15,
                ease: [0.25, 0.4, 0.25, 1],
              }}
              className="relative"
            >
              {/* Connector line (desktop) — metallic gradient */}
              {i < steps.length - 1 && (
                <div
                  className="hidden md:block absolute top-12 left-[calc(50%+48px)] w-[calc(100%-96px)] h-px z-0"
                  style={{ background: "linear-gradient(90deg, #d4b8a4 0%, #e8d5c8 50%, #d4b8a4 100%)" }}
                />
              )}

              <div className="flex flex-col items-center text-center">
                <motion.div
                  whileHover={{ scale: 1.06, y: -2 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="w-24 h-24 rounded-[20px] flex items-center justify-center mb-6 relative z-10"
                  style={{
                    background: "linear-gradient(145deg, #faf6f3 0%, #f0e8e2 50%, #e8ddd6 100%)",
                    boxShadow: "0 4px 20px rgba(150, 96, 86, 0.08), 0 1px 3px rgba(150, 96, 86, 0.06), inset 0 1px 0 rgba(255,255,255,0.7)",
                    border: "1px solid rgba(198, 159, 135, 0.25)",
                  }}
                >
                  {step.icon}
                </motion.div>
                <h3 className="text-lg font-medium text-[#1a1a1a] mb-2 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-[0.9375rem] leading-[1.7] text-gray-500 max-w-[320px]">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
});

export default HowItWorks;
