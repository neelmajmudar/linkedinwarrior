"use client";

import { memo } from "react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  Sparkles,
  CalendarDays,
  MessageSquareMore,
  Search,
  BarChart3,
  Clock,
  Zap,
  Shield,
} from "lucide-react";

const features = [
  {
    number: "01",
    label: "AI Post Generation",
    title: "Your voice.\nAmplified by AI.",
    description:
      "We analyze your LinkedIn presence to build a voice profile, then generate posts that sound authentically you. RAG-powered with streaming — drafts appear in seconds, not minutes.",
    icon: Sparkles,
    gradient: "from-amber-50 to-orange-50",
    iconColor: "text-amber-600",
    size: "large" as const,
  },
  {
    number: "02",
    label: "Content Calendar",
    title: "One calendar.\nFull visibility.",
    description:
      "See every post — draft, scheduled, published — laid out visually. Drag to reschedule, click to edit. Never miss your posting cadence again.",
    icon: CalendarDays,
    gradient: "from-blue-50 to-indigo-50",
    iconColor: "text-blue-600",
    size: "large" as const,
  },
  {
    number: "03",
    label: "Smart Auto-Engagement",
    title: "Engage authentically.\nAt scale.",
    description:
      "Our AI agent finds relevant posts in your niche, crafts thoughtful comments in your voice, and lets you approve before posting. Build relationships on autopilot.",
    icon: MessageSquareMore,
    gradient: "from-emerald-50 to-teal-50",
    iconColor: "text-emerald-600",
    size: "large" as const,
  },
  {
    number: "04",
    label: "Creator Research",
    title: "Know your niche\ninside out.",
    description:
      "Search any topic, discover top creators, and get AI-powered competitive analysis reports.",
    icon: Search,
    gradient: "from-violet-50 to-purple-50",
    iconColor: "text-violet-600",
    size: "small" as const,
  },
  {
    number: "05",
    label: "Analytics Dashboard",
    title: "See what's\nactually working.",
    description:
      "Track impressions, engagement rates, follower growth, and top-performing posts with beautiful charts.",
    icon: BarChart3,
    gradient: "from-rose-50 to-pink-50",
    iconColor: "text-rose-600",
    size: "small" as const,
  },
  {
    number: "06",
    label: "Scheduled Publishing",
    title: "Set it.\nForget it.",
    description:
      "Schedule posts for optimal times. Our Celery-powered engine fires them with sub-minute precision.",
    icon: Clock,
    gradient: "from-cyan-50 to-sky-50",
    iconColor: "text-cyan-600",
    size: "small" as const,
  },
];

const FeatureCardLarge = memo(function FeatureCardLarge({
  feature,
  index,
  reverse,
}: {
  feature: (typeof features)[0];
  index: number;
  reverse?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const Icon = feature.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.25, 0.4, 0.25, 1] }}
      className="rounded-xl bg-gray-50 flex flex-col lg:flex-row gap-0 items-stretch overflow-hidden shadow-[inset_0_1px_4px_rgba(0,0,0,0.025)] group"
    >
      <div
        className={`space-y-4 lg:space-y-6 lg:w-1/2 p-8 md:p-10 lg:p-16 flex flex-col justify-center ${
          reverse ? "order-1 lg:order-2" : ""
        }`}
      >
        <div className="space-y-1 flex flex-col md:flex-row md:items-center md:gap-2 justify-between flex-wrap">
          <span className="text-xs text-[#1a1a1a] opacity-50">{feature.number}</span>
          <p className="text-xs uppercase tracking-widest text-[#1a1a1a]/50">
            {feature.label}
          </p>
        </div>
        <div className="flex flex-col gap-3 h-full justify-center">
          <h3 className="text-2xl md:text-4xl leading-[1.2] tracking-[-0.01em] text-[#1a1a1a] font-normal whitespace-pre-line">
            {feature.title}
          </h3>
          <p className="text-base leading-[1.7] text-[#333]/70">{feature.description}</p>
        </div>
      </div>
      <div
        className={`lg:w-1/2 flex items-center justify-center p-8 md:p-12 lg:p-16 ${
          reverse ? "order-2 lg:order-1" : ""
        }`}
      >
        <div
          className={`w-full aspect-square max-w-[320px] rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center transition-transform duration-700 group-hover:scale-105`}
        >
          <motion.div
            initial={{ scale: 0.8, rotate: -5 }}
            animate={isInView ? { scale: 1, rotate: 0 } : {}}
            transition={{ duration: 0.8, delay: index * 0.1 + 0.3, ease: "backOut" }}
          >
            <Icon className={`w-20 h-20 md:w-24 md:h-24 ${feature.iconColor} opacity-80`} strokeWidth={1.2} />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
});

const FeatureCardSmall = memo(function FeatureCardSmall({
  feature,
  index,
}: {
  feature: (typeof features)[0];
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  const Icon = feature.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.12, ease: [0.25, 0.4, 0.25, 1] }}
      className="rounded-xl bg-gray-50 shadow-[inset_0_1px_4px_rgba(0,0,0,0.025)] overflow-hidden group hover:shadow-md transition-shadow duration-300"
    >
      <div className={`p-6 md:p-4 flex items-center justify-center bg-gradient-to-br ${feature.gradient}`}>
        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Icon className={`w-12 h-12 ${feature.iconColor} opacity-80`} strokeWidth={1.2} />
        </motion.div>
      </div>
      <div className="px-6 pb-6 pt-4 md:px-6 space-y-4">
        <div className="space-y-0.5 flex flex-col md:flex-row md:items-center md:gap-2 justify-between flex-wrap">
          <span className="text-xs text-[#1a1a1a] opacity-50">{feature.number}</span>
          <p className="text-xs uppercase tracking-widest text-[#1a1a1a]/50">
            {feature.label}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-xl leading-[1.2] tracking-[-0.01em] text-[#1a1a1a] font-normal whitespace-pre-line">
            {feature.title}
          </h3>
          <p className="text-[0.9375rem] leading-[1.7] text-[#333]/70">
            {feature.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
});

const FeatureCards = memo(function FeatureCards() {
  const largeFeatures = features.filter((f) => f.size === "large");
  const smallFeatures = features.filter((f) => f.size === "small");

  return (
    <div className="space-y-6">
      {largeFeatures.map((feature, i) => (
        <FeatureCardLarge
          key={feature.number}
          feature={feature}
          index={i}
          reverse={i % 2 === 1}
        />
      ))}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {smallFeatures.map((feature, i) => (
          <FeatureCardSmall key={feature.number} feature={feature} index={i} />
        ))}
      </div>
    </div>
  );
});

export default FeatureCards;
