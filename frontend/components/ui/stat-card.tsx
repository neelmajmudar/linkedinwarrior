"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  index?: number;
}

export default function StatCard({ label, value, icon, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.08 * index, ease: [0.25, 0.4, 0.25, 1] }}
      className="stat-card group"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-warm-50 flex items-center justify-center text-warm-500 group-hover:bg-warm-100 transition-colors">
          {icon}
        </div>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">{value}</p>
    </motion.div>
  );
}
