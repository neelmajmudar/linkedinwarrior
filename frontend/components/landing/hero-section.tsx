"use client";

import { memo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const letterVariants = {
  hidden: { opacity: 0, y: 3 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.5 + i * 0.03, duration: 0.4, ease: [0, 0, 0.2, 1] as const },
  }),
};

const HeroSection = memo(function HeroSection() {
  const tagline = "AI-Powered LinkedIn Growth Engine";
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Listen for auth state changes first so we catch late session restoration
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (mounted) setIsLoggedIn(!!session);
    });
    // Then check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setIsLoggedIn(!!session);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <section className="w-full min-h-[90vh] px-4 sm:px-8 md:px-16 lg:px-24 pt-24 md:pt-32 lg:pt-40 pb-16 text-center relative overflow-hidden bg-white">
      {/* Gradient background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[140%] h-[60%] opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at center top, var(--warm-1) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-[200px]"
          style={{ background: "linear-gradient(to bottom, transparent, white)" }}
        />
      </div>

      {/* Header / Nav */}
      <header className="absolute top-0 left-0 right-0 z-50 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-24 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] flex items-center justify-center">
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
                <path d="M13 19l6-6" />
                <path d="M16 16l4 4" />
                <path d="M19 21l2-2" />
              </svg>
            </div>
            <span className="text-lg font-medium tracking-tight text-[#1a1a1a]">
              LinkedInWarrior
            </span>
          </Link>
          <div className="flex gap-2 md:gap-3 items-center">
            <Link
              href="#features"
              className="hidden sm:inline-flex px-3 py-1.5 text-[#1a1a1a] text-sm rounded-full font-normal items-center justify-center transition-colors hover:bg-black/5"
            >
              Features
            </Link>
            <Link
              href="#stats"
              className="hidden sm:inline-flex px-3 py-1.5 text-[#1a1a1a] text-sm rounded-full font-normal items-center justify-center transition-colors hover:bg-black/5"
            >
              Results
            </Link>
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="inline-flex font-medium items-center justify-center hover:bg-gray-800 transition-colors px-5 py-2.5 bg-[#1a1a1a] text-white text-sm rounded-full gap-1.5"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                Dashboard
              </Link>
            ) : (
              <Link
                href="/dashboard"
                className="inline-flex font-medium items-center justify-center hover:bg-gray-800 transition-colors px-5 py-2.5 bg-[#1a1a1a] text-white text-sm rounded-full"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Content */}
      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Animated tagline */}
        <motion.div
          className="mb-6 md:mb-8 flex items-center justify-center gap-1"
          style={{ fontSize: "0.875rem", color: "rgba(26, 26, 26, 0.7)" }}
        >
          {tagline.split("").map((char, i) => (
            <motion.span
              key={i}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={letterVariants}
              style={{ display: "inline-block" }}
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          ))}
        </motion.div>

        {/* Main heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
          className="font-normal leading-tight tracking-tight max-w-[750px] mx-auto"
          style={{
            fontSize: "clamp(2.3rem, 5vw, 4.2rem)",
            letterSpacing: "-0.03em",
            color: "#1a1a1a",
            lineHeight: 1.1,
          }}
        >
          Grow Your LinkedIn
          <br />
          <span className="gradient-text">With AI That Sounds Like You</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
          className="text-center text-lg md:text-xl text-gray-500 mx-auto leading-relaxed max-w-[540px] mt-4 mb-10"
        >
          Generate authentic posts, auto-engage with your audience, and schedule
          content — all powered by your unique voice profile.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
          className="flex gap-4 justify-center flex-wrap"
        >
          <Link
            href="/dashboard"
            className="inline-flex px-8 py-4 bg-[#1a1a1a] text-white text-base rounded-full font-medium items-center justify-center hover:bg-gray-800 transition-all hover:shadow-lg hover:-translate-y-0.5 gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 2.5V13.5L13 8L3 2.5Z" fill="currentColor" />
            </svg>
            Start Free
          </Link>
          <Link
            href="#features"
            className="inline-flex px-6 py-4 bg-transparent text-[#1a1a1a] text-base rounded-full font-normal items-center justify-center hover:bg-black/5 transition-colors border border-gray-200"
          >
            See How It Works
          </Link>
        </motion.div>
      </div>

      {/* Floating gradient orbs */}
      <div className="absolute top-[20%] left-[10%] w-64 h-64 rounded-full bg-gradient-to-br from-amber-100/40 to-orange-100/20 blur-3xl pointer-events-none animate-float-slow" />
      <div className="absolute top-[30%] right-[8%] w-72 h-72 rounded-full bg-gradient-to-br from-blue-100/30 to-indigo-100/20 blur-3xl pointer-events-none animate-float-slower" />
    </section>
  );
});

export default HeroSection;
