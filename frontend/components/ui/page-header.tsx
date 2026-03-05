"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  titleAccent?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function PageHeader({ title, titleAccent, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header-gradient mb-8">
      <div className="flex items-start justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
        >
          <h2 className="text-[1.75rem] tracking-tight text-[#1a1a1a] leading-tight">
            {title}
            {titleAccent && (
              <>
                {" "}
                <span className="gradient-text">{titleAccent}</span>
              </>
            )}
          </h2>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1.5 max-w-lg leading-relaxed">
              {subtitle}
            </p>
          )}
        </motion.div>
        {actions && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.4, 0.25, 1] }}
            className="flex-shrink-0"
          >
            {actions}
          </motion.div>
        )}
      </div>
    </div>
  );
}
