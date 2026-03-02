"use client";

import { memo, useRef, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";
import dynamic from "next/dynamic";

const IsometricCards = dynamic(() => import("./illustrations/isometric-cards"), {
  ssr: false,
  loading: () => <div className="w-full min-h-[360px] rounded-2xl bg-gray-50 animate-pulse" />,
});
const StrategyTerminal = dynamic(() => import("./illustrations/strategy-terminal"), {
  ssr: false,
  loading: () => <div className="w-full min-h-[320px] rounded-2xl bg-gray-50 animate-pulse" />,
});
const PostToneAnalysis = dynamic(() => import("./illustrations/post-tone-analysis"), {
  ssr: false,
  loading: () => <div className="w-full min-h-[320px] rounded-2xl bg-gray-50 animate-pulse" />,
});
const CalendarCards = dynamic(() => import("./illustrations/calendar-cards"), {
  ssr: false,
  loading: () => <div className="w-full min-h-[320px] rounded-2xl bg-gray-50 animate-pulse" />,
});
const ScrollingAudience = dynamic(() => import("./illustrations/scrolling-audience"), {
  ssr: false,
  loading: () => <div className="w-full min-h-[280px] rounded-2xl bg-gray-50 animate-pulse" />,
});

interface Feature {
  number: string;
  label: string;
  title: string;
  description: string;
  illustration: ReactNode;
  size: "large" | "small";
}

const features: Feature[] = [
  {
    number: "01",
    label: "Voice Profile",
    title: "Your voice.\nAmplified by AI.",
    description:
      "We analyze your LinkedIn presence to build a voice profile, then generate posts that sound authentically you. RAG-powered with streaming — drafts appear in seconds, not minutes.",
    illustration: <IsometricCards />,
    size: "large",
  },
  {
    number: "02",
    label: "AI Strategy",
    title: "A strategy engine\nthat thinks for you.",
    description:
      "Get a complete content strategy — messaging pillars, tone guidelines, do's & don'ts — all reverse-engineered from top creators in your niche.",
    illustration: <StrategyTerminal />,
    size: "large",
  },
  {
    number: "03",
    label: "Smart Post Generation",
    title: "Posts that land.\nEvery time.",
    description:
      "Our AI crafts LinkedIn posts with built-in tone analysis. See exactly how your content reads — thought-provoking, inspiring, or too clickbait — before you publish.",
    illustration: <PostToneAnalysis />,
    size: "large",
  },
  {
    number: "04",
    label: "Content Calendar",
    title: "We handle the content.\nYou stay in control.",
    description:
      "Our AI drafts and schedules your content. You review it, approve it, or change it. Nothing goes live without your sign-off.",
    illustration: <CalendarCards />,
    size: "large",
  },
  {
    number: "05",
    label: "Audience Targeting",
    title: "Built for the people\nwho build.",
    description:
      "Whether you're a SaaS founder, growth hacker, or GTM leader — our AI understands your audience and speaks their language.",
    illustration: <ScrollingAudience />,
    size: "large",
  },
];

const FeatureCardLarge = memo(function FeatureCardLarge({
  feature,
  index,
  reverse,
}: {
  feature: Feature;
  index: number;
  reverse?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.25, 0.4, 0.25, 1] }}
      className="rounded-2xl bg-gray-50/80 flex flex-col lg:flex-row gap-0 items-stretch overflow-hidden border border-gray-100 group"
    >
      {/* Text side */}
      <div
        className={`lg:w-[45%] p-8 md:p-10 lg:p-14 flex flex-col justify-center ${
          reverse ? "order-1 lg:order-2" : ""
        }`}
      >
        <div className="space-y-1 flex flex-row items-center gap-2 justify-between flex-wrap mb-6">
          <span className="text-xs text-[#1a1a1a] opacity-50">{feature.number}</span>
          <p className="text-xs uppercase tracking-widest text-[#1a1a1a]/50">
            {feature.label}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-2xl md:text-[2.25rem] leading-[1.15] tracking-[-0.02em] text-[#1a1a1a] font-normal whitespace-pre-line">
            {feature.title}
          </h3>
          <p className="text-base leading-[1.7] text-[#333]/65">{feature.description}</p>
        </div>
      </div>

      {/* Illustration side */}
      <div
        className={`lg:w-[55%] flex items-center justify-center p-4 md:p-6 ${
          reverse ? "order-2 lg:order-1" : ""
        }`}
      >
        <div className="w-full rounded-xl overflow-hidden transition-transform duration-700 group-hover:scale-[1.02]">
          {feature.illustration}
        </div>
      </div>
    </motion.div>
  );
});

const FeatureCards = memo(function FeatureCards() {
  return (
    <div className="space-y-6">
      {features.map((feature, i) => (
        <FeatureCardLarge
          key={feature.number}
          feature={feature}
          index={i}
          reverse={i % 2 === 1}
        />
      ))}
    </div>
  );
});

export default FeatureCards;
