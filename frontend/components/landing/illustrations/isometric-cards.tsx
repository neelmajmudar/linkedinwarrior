"use client";

import { memo } from "react";
import { motion } from "framer-motion";

const cardClass =
  "bg-white rounded-lg shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-gray-100";

const IsometricCards = memo(function IsometricCards() {
  return (
    <div className="relative w-full h-full min-h-[360px] flex items-center justify-center overflow-hidden">
      {/* Warm gradient background */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background:
            "linear-gradient(145deg, #e8ddd6 0%, #d4c4b8 40%, #c6b09e 100%)",
        }}
      />

      {/* Isometric container — use flex column for stacking with 3D transform */}
      <div
        className="relative flex flex-col items-center gap-3"
        style={{
          transform: "perspective(900px) rotateX(40deg) rotateZ(-30deg)",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Card 1 — top (LinkedIn profile) */}
        <motion.div
          initial={{ opacity: 0, y: -30, z: -20 }}
          whileInView={{ opacity: 1, y: 0, z: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          viewport={{ once: true }}
          className={`${cardClass} w-[280px] p-4`}
          style={{ transform: "translateZ(40px)" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-5 h-5 text-gray-300 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            <div>
              <p className="text-[10px] font-mono text-gray-700 font-medium">Neel Majmudar</p>
              <p className="text-[7px] font-mono text-gray-400 leading-snug">
                AI/ML Engineer Co-Op @ CrediLinq.Ai
              </p>
              <p className="text-[7px] font-mono text-gray-300 leading-snug">
                Computer Science, AI/ML | AI for Growth &amp; Marketing
              </p>
            </div>
          </div>
        </motion.div>

        {/* Card 2 — middle (voice settings) */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          viewport={{ once: true }}
          className={`${cardClass} w-[280px] p-4`}
          style={{ transform: "translateZ(20px)" }}
        >
          <p className="text-[9px] font-mono text-gray-400 uppercase tracking-wider mb-2">
            Voice Profile
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono text-gray-500 w-12">TONE</span>
              <div className="flex-1 h-1.5 bg-gray-50 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-200 to-amber-300"
                  initial={{ width: 0 }}
                  whileInView={{ width: "65%" }}
                  transition={{ duration: 1, delay: 0.8 }}
                  viewport={{ once: true }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono text-gray-500 w-12">STYLE</span>
              <div className="flex-1 h-1.5 bg-gray-50 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-orange-200 to-orange-300"
                  initial={{ width: 0 }}
                  whileInView={{ width: "80%" }}
                  transition={{ duration: 1, delay: 0.9 }}
                  viewport={{ once: true }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-mono text-gray-500 w-12">DEPTH</span>
              <div className="flex-1 h-1.5 bg-gray-50 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-red-200 to-red-300"
                  initial={{ width: 0 }}
                  whileInView={{ width: "45%" }}
                  transition={{ duration: 1, delay: 1.0 }}
                  viewport={{ once: true }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Card 3 — bottom (audience) */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          viewport={{ once: true }}
          className={`${cardClass} w-[280px] p-4`}
          style={{ transform: "translateZ(0px)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
            </div>
            <div className="space-y-1">
              <div className="h-2 w-24 bg-gray-100 rounded-full" />
              <div className="h-1.5 w-36 bg-gray-50 rounded-full" />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
});

export default IsometricCards;
