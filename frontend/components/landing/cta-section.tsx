"use client";

import { memo, useRef } from "react";
import { motion, useInView } from "framer-motion";
import Link from "next/link";

const CTASection = memo(function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <>
      {/* Gradient transition */}
      <div className="w-full h-40 sm:h-64 md:h-80 lg:h-96 bg-gradient-to-b from-white via-[#e5ddd6] to-[#ddcdc4]" />

      <section
        ref={ref}
        id="cta"
        className="w-full px-8 md:px-16 lg:px-24 py-20 sm:py-32 md:py-40 text-center"
        style={{
          background: "linear-gradient(to bottom, #ddcdc4, #c69f87, #966056, #69494a)",
        }}
      >
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.25, 0.4, 0.25, 1] }}
          className="mb-4 md:mb-6 font-normal leading-tight tracking-tight max-w-3xl mx-auto text-white"
          style={{
            fontSize: "clamp(2rem, 4vw, 3.2rem)",
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          Ready to dominate
          <br />
          your LinkedIn presence?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-center max-w-2xl mx-auto mb-10"
          style={{ fontSize: "1.125rem", color: "rgba(255, 255, 255, 0.8)", lineHeight: 1.6 }}
        >
          Join creators and founders using AI to build their personal brand on autopilot.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
          className="flex gap-4 justify-center flex-wrap"
        >
          <Link
            href="/dashboard"
            className="px-8 py-4 bg-white text-[#1a1a1a] text-base rounded-full font-medium inline-flex items-center justify-center hover:bg-gray-100 transition-all hover:shadow-lg hover:-translate-y-0.5"
          >
            Get Started Free
          </Link>
          <Link
            href="#features"
            className="px-6 py-4 bg-transparent text-white text-sm rounded-full font-normal inline-flex items-center justify-center hover:bg-white/10 transition-colors border border-white/30"
          >
            Learn More
          </Link>
        </motion.div>
      </section>
    </>
  );
});

export default CTASection;
