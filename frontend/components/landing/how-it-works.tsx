"use client";

import { memo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Cpu, Pen, Send } from "lucide-react";

const steps = [
  {
    icon: Cpu,
    title: "1. Build Your Voice Profile",
    description:
      "Connect your LinkedIn. We analyze your past posts, writing style, and audience to create a unique AI voice model that captures how you actually communicate.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: Pen,
    title: "2. Generate & Refine",
    description:
      "Tell us your topic — or let the AI suggest trending themes in your niche. Get drafts in seconds that sound like you wrote them. Edit, polish, or approve as-is.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Send,
    title: "3. Schedule & Engage",
    description:
      "Schedule posts for optimal times. Enable auto-engagement to comment thoughtfully on relevant posts in your niche. Watch your network grow while you focus on your business.",
    color: "bg-emerald-50 text-emerald-600",
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
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
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
                {/* Connector line (desktop) */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-gray-200 z-0" />
                )}

                <div className="flex flex-col items-center text-center">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className={`w-20 h-20 rounded-2xl ${step.color} flex items-center justify-center mb-6 relative z-10`}
                  >
                    <Icon className="w-9 h-9" strokeWidth={1.5} />
                  </motion.div>
                  <h3 className="text-lg font-medium text-[#1a1a1a] mb-2 tracking-tight">
                    {step.title}
                  </h3>
                  <p className="text-[0.9375rem] leading-[1.7] text-gray-500 max-w-[320px]">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
});

export default HowItWorks;
