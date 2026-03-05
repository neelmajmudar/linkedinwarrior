"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface SectionCardProps {
  children: ReactNode;
  className?: string;
  index?: number;
  noPadding?: boolean;
}

export default function SectionCard({ children, className = "", index = 0, noPadding = false }: SectionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.06 * index, ease: [0.25, 0.4, 0.25, 1] }}
      className={`section-card ${noPadding ? "" : "p-5"} ${className}`}
    >
      {children}
    </motion.div>
  );
}
