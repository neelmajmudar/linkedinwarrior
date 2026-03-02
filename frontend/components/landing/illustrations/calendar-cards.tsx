"use client";

import { memo } from "react";
import { motion } from "framer-motion";

const days = [
  {
    day: "Wed",
    offset: 0,
    zIndex: 1,
    posts: [
      { title: "[Repost] We jus…", subtitle: "YC group chat…", time: "01:00 AM", color: "bg-blue-100" },
      { title: "Have you ever…", subtitle: "thought about…", time: "03:00 AM", color: "bg-red-100" },
      { title: "[Untitled Draft]", subtitle: "We are building…", time: "03:30 AM", color: "bg-green-100" },
    ],
  },
  {
    day: "Thu",
    offset: 50,
    zIndex: 2,
    posts: [
      { title: "We just launched", subtitle: "multi-member tea…", time: "11:30 AM", color: "bg-purple-100" },
      { title: "3 things I learned", subtitle: "from scaling to 1K…", time: "02:00 PM", color: "bg-orange-100" },
      { title: "[Thought Leader]", subtitle: "Hot take: most AI…", time: "04:30 PM", color: "bg-teal-100" },
      { title: "We're hiring a ne…", subtitle: "UX writer but we…", time: "06:00 PM", color: "bg-pink-100" },
    ],
  },
  {
    day: "Fri",
    offset: 100,
    zIndex: 3,
    posts: [
      { title: "Our first angel", subtitle: "investor told us to…", time: "09:00 AM", color: "bg-indigo-100" },
      { title: "[Company Culture]", subtitle: "It's been almost 2…", time: "12:30 PM", color: "bg-amber-100" },
      { title: "The playbook that", subtitle: "got us 50K views…", time: "03:30 PM", color: "bg-cyan-100" },
      { title: "I'm judging at the", subtitle: "c0mpiled-5 hacka…", time: "06:00 PM", color: "bg-rose-100" },
    ],
  },
];

const CalendarCards = memo(function CalendarCards() {
  return (
    <div className="relative w-full h-full min-h-[320px] flex items-center justify-center overflow-hidden">
      {/* Light blue gradient background */}
      <div
        className="absolute inset-0 rounded-2xl"
        style={{
          background:
            "linear-gradient(145deg, #e6eef6 0%, #dae4f0 40%, #d0dcea 100%)",
        }}
      />

      {/* Stacked day columns */}
      <div className="relative flex items-end justify-center gap-0 mt-4">
        {days.map((day, di) => (
          <motion.div
            key={day.day}
            initial={{ opacity: 0, y: 30, x: -20 }}
            whileInView={{ opacity: 1, y: 0, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 + di * 0.15 }}
            viewport={{ once: true }}
            className="bg-white rounded-lg shadow-lg border border-gray-100 w-[130px] p-3 -ml-6 first:ml-0"
            style={{ zIndex: day.zIndex, transform: `translateY(${-di * 8}px)` }}
          >
            {/* Day header */}
            <p className="text-xs font-semibold text-gray-700 mb-2">{day.day}</p>

            {/* Post items */}
            <div className="space-y-1.5">
              {day.posts.map((post, pi) => (
                <motion.div
                  key={pi}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 0.5 + di * 0.15 + pi * 0.08 }}
                  viewport={{ once: true }}
                  className="flex items-start gap-1.5"
                >
                  <div className={`w-5 h-5 rounded-full ${post.color} flex-shrink-0 mt-0.5`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[7px] font-medium text-gray-700 truncate leading-tight">
                      {post.title}
                    </p>
                    <p className="text-[6px] text-gray-400 truncate leading-tight">
                      {post.subtitle}
                    </p>
                    <p className="text-[6px] text-amber-500">{post.time}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
});

export default CalendarCards;
