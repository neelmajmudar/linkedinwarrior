"use client";

import { memo } from "react";
import { motion } from "framer-motion";

const lines = [
  { label: "RECEIPTS", items: ["Ops revamp: -38% cycle time.", "Onboarding: time-to-impact 21→10 days.", "Playbooks used by 40+ teams."] },
  { label: "DONT", items: ["DO: show numbers; name constraints; give templates.", "DONT: vague inspiration; unbounded advice."] },
  { label: "MESSAGING", items: ["- Tagline: Build systems that scale people.", "- Elevator (70w): I help growth-stage teams turn chaos into operating systems."] },
];

const StrategyTerminal = memo(function StrategyTerminal() {
  return (
    <div className="relative w-full h-full min-h-[320px] flex items-center justify-center overflow-hidden">
      {/* Warm gradient background */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background:
            "linear-gradient(160deg, #e8ddd6 0%, #d4c0b0 50%, #b8a090 100%)",
        }}
      />

      {/* Floating name badge */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        viewport={{ once: true }}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white rounded-lg shadow-lg px-4 py-3 border border-gray-100"
      >
        <p className="text-sm font-semibold text-gray-800">John Smith</p>
        <p className="text-xs text-amber-600">CEO</p>
      </motion.div>

      {/* Terminal window */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        viewport={{ once: true }}
        className="relative bg-white/95 backdrop-blur rounded-lg shadow-xl border border-gray-200 w-[75%] max-w-[340px] max-h-[280px] overflow-hidden ml-12"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
          <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
          <div className="w-2.5 h-2.5 rounded-full bg-gray-200" />
        </div>

        {/* Terminal content */}
        <div className="p-4 space-y-3 overflow-hidden">
          {lines.map((section, si) => (
            <motion.div
              key={section.label}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 + si * 0.2 }}
              viewport={{ once: true }}
            >
              <p className="text-[9px] font-mono font-bold text-gray-700 uppercase tracking-wider mb-0.5">
                {section.label}
              </p>
              {section.items.map((item, ii) => (
                <p
                  key={ii}
                  className="text-[8px] font-mono text-gray-500 leading-relaxed"
                >
                  {item}
                </p>
              ))}
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
});

export default StrategyTerminal;
