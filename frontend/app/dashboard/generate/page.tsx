"use client";

import dynamic from "next/dynamic";

const PostGenerator = dynamic(() => import("@/components/post-generator"), {
  loading: () => (
    <div className="space-y-6">
      <div>
        <div className="skeleton h-7 w-56 rounded mb-2" />
        <div className="skeleton h-4 w-80 rounded" />
      </div>
      <div className="skeleton h-32 w-full rounded-lg" />
      <div className="flex gap-3">
        <div className="skeleton h-10 w-28 rounded-full" />
        <div className="skeleton h-10 w-28 rounded-full" />
      </div>
    </div>
  ),
});

export default function GeneratePage() {
  return <PostGenerator />;
}
