"use client";

import { memo } from "react";
import AnimatedCard from "./animated-card";
import AnimatedCounter from "./animated-counter";

const StatsSection = memo(function StatsSection() {
  return (
    <section id="stats" className="w-full px-8 md:px-16 lg:px-24 pt-24 md:pt-32 pb-32 md:pb-40 bg-white">
      <div className="max-w-7xl mx-auto">
        <AnimatedCard>
          <div className="flex flex-col gap-1 md:gap-3 mb-10 md:mb-16">
            <h2 className="font-normal text-3xl md:text-5xl tracking-[-0.02em] text-[#1a1a1a] text-center">
              Results That Speak
            </h2>
            <p className="text-center text-base md:text-lg text-gray-500 mx-auto max-w-[500px]">
              Real numbers from real users on the platform.
            </p>
          </div>
        </AnimatedCard>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
          <div className="sm:col-span-2 lg:col-span-2 lg:row-span-2">
            <AnimatedCard delay={0.1} className="h-full">
              <div className="rounded-xl bg-gray-50 p-10 md:p-12 flex flex-col justify-center h-full shadow-[inset_0_1px_4px_rgba(0,0,0,0.025)]">
                <div className="space-y-4">
                  <div
                    className="text-5xl md:text-6xl lg:text-7xl text-[#1a1a1a] gradient-text"
                    style={{ letterSpacing: "-0.03em", fontWeight: 400 }}
                  >
                    10x
                  </div>
                  <p
                    className="text-lg"
                    style={{ color: "rgba(51, 51, 51, 0.8)", lineHeight: 1.6 }}
                  >
                    Average increase in LinkedIn engagement after 30 days
                  </p>
                </div>
              </div>
            </AnimatedCard>
          </div>
          <AnimatedCard delay={0.2}>
            <AnimatedCounter target={50000} prefix="" suffix="+" label="Posts generated" />
          </AnimatedCard>
          <AnimatedCard delay={0.3}>
            <AnimatedCounter target={12} prefix="" suffix="M" label="Total impressions driven" />
          </AnimatedCard>
          <AnimatedCard delay={0.4}>
            <AnimatedCounter target={10400} prefix="" suffix="" label="Hours saved for our users" />
          </AnimatedCard>
          <AnimatedCard delay={0.5}>
            <AnimatedCounter target={95} prefix="" suffix="%" label="User satisfaction rate" />
          </AnimatedCard>
        </div>
      </div>
    </section>
  );
});

export default StatsSection;
