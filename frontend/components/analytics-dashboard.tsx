"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost } from "@/lib/api";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  TrendingUp,
  Eye,
  Heart,
  MessageSquare,
  Repeat2,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface AnalyticsData {
  summary: {
    total_posts: number;
    total_reactions: number;
    total_comments: number;
    total_reposts: number;
    total_impressions: number;
    avg_engagement_rate: number;
  };
  follower_history: { followers_count: number; snapshot_date: string }[];
  top_posts: {
    id: string;
    linkedin_post_id: string;
    post_text: string;
    reactions: number;
    comments: number;
    reposts: number;
    impressions: number;
    snapshot_date: string;
  }[];
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    try {
      const result = await apiGet<AnalyticsData>("/api/analytics");
      setData(result);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await apiPost("/api/analytics/refresh");
      await loadAnalytics();
    } catch {
      // ignore
    }
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  const summary = data?.summary || {
    total_posts: 0,
    total_reactions: 0,
    total_comments: 0,
    total_reposts: 0,
    total_impressions: 0,
    avg_engagement_rate: 0,
  };

  const followerData = (data?.follower_history || []).map((d) => ({
    date: d.snapshot_date,
    followers: d.followers_count,
  }));

  const postData = (data?.top_posts || [])
    .slice(0, 10)
    .map((p, i) => ({
      name: `Post ${i + 1}`,
      reactions: p.reactions,
      comments: p.comments,
      impressions: p.impressions,
      reposts: p.reposts,
    }));

  const statCards = [
    {
      label: "Total Impressions",
      value: summary.total_impressions.toLocaleString(),
      icon: <Eye className="h-4 w-4" />,
      color: "text-blue-500",
    },
    {
      label: "Total Reactions",
      value: summary.total_reactions.toLocaleString(),
      icon: <Heart className="h-4 w-4" />,
      color: "text-pink-500",
    },
    {
      label: "Total Comments",
      value: summary.total_comments.toLocaleString(),
      icon: <MessageSquare className="h-4 w-4" />,
      color: "text-amber-500",
    },
    {
      label: "Engagement Rate",
      value: `${summary.avg_engagement_rate}%`,
      icon: <TrendingUp className="h-4 w-4" />,
      color: "text-emerald-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight mb-1">
            LinkedIn <span className="gradient-text">Analytics</span>
          </h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Track your engagement, followers, and post performance over time.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5 border border-[var(--border)] rounded-lg disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="glass-card p-4 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className={card.color}>{card.icon}</span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {card.label}
              </span>
            </div>
            <p className="text-2xl font-bold tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Follower trend chart */}
      {followerData.length > 1 && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--primary)]" />
            <h3 className="text-sm font-medium">Followers Over Time</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={followerData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="followers"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Post performance chart */}
      {postData.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--primary)]" />
            <h3 className="text-sm font-medium">Post Performance</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={postData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="impressions" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Views" />
              <Bar dataKey="reactions" fill="#ec4899" radius={[4, 4, 0, 0]} name="Reactions" />
              <Bar dataKey="comments" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Comments" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top posts table */}
      {(data?.top_posts || []).length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-medium">Top Performing Posts</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 px-2 text-xs font-medium text-[var(--muted-foreground)]">
                    Post
                  </th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-[var(--muted-foreground)]">
                    <Eye className="h-3 w-3 inline" /> Views
                  </th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-[var(--muted-foreground)]">
                    <Heart className="h-3 w-3 inline" /> Reactions
                  </th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-[var(--muted-foreground)]">
                    <MessageSquare className="h-3 w-3 inline" /> Comments
                  </th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-[var(--muted-foreground)]">
                    <Repeat2 className="h-3 w-3 inline" /> Reposts
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data?.top_posts || []).map((post) => (
                  <tr
                    key={post.id}
                    className="border-b border-[var(--border)] last:border-0"
                  >
                    <td className="py-2 px-2 max-w-[250px]">
                      <p className="truncate text-[var(--card-foreground)]">
                        {post.post_text || "—"}
                      </p>
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">
                      {post.impressions.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">
                      {post.reactions.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">
                      {post.comments.toLocaleString()}
                    </td>
                    <td className="text-right py-2 px-2 tabular-nums">
                      {post.reposts.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!data?.top_posts?.length && !followerData.length && (
        <div className="glass-card p-8 text-center space-y-2">
          <TrendingUp className="h-8 w-8 mx-auto text-[var(--muted-foreground)] opacity-40" />
          <p className="text-sm text-[var(--muted-foreground)]">
            No analytics data yet. Click &quot;Refresh Data&quot; to fetch your latest LinkedIn metrics,
            or wait for the daily automatic snapshot.
          </p>
        </div>
      )}
    </div>
  );
}
