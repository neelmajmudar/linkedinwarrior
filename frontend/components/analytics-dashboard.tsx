"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost } from "@/lib/api";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

interface MetricTrend {
  date: string;
  impressions: number;
  reactions: number;
  comments: number;
  reposts: number;
  post_count: number;
  engagement_rate: number;
}

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
  metric_trends: MetricTrend[];
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
      console.log("[Analytics] Received data:", result);
      console.log("[Analytics] metric_trends:", result.metric_trends);
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
        <Loader2 className="h-6 w-6 animate-spin text-warm-500" />
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
  
  // If only 1 data point, add origin point for line visualization
  const followerChartData = followerData.length === 1 
    ? [{ date: '', followers: 0 }, ...followerData]
    : followerData;

  const postData = (data?.top_posts || [])
    .slice(0, 10)
    .map((p, i) => ({
      name: `Post ${i + 1}`,
      reactions: p.reactions,
      comments: p.comments,
      impressions: p.impressions,
      reposts: p.reposts,
    }));

  const trendData = (data?.metric_trends || []).map((d) => ({
    date: d.date,
    impressions: d.impressions,
    reactions: d.reactions,
    comments: d.comments,
    reposts: d.reposts,
    engagement_rate: d.engagement_rate,
  }));
  
  // If only 1 data point, add origin point for line visualization
  const trendChartData = trendData.length === 1
    ? [{ date: '', impressions: 0, reactions: 0, comments: 0, reposts: 0, engagement_rate: 0 }, ...trendData]
    : trendData;

  const statCards = [
    {
      label: "Total Impressions",
      value: summary.total_impressions.toLocaleString(),
      icon: <Eye className="h-4 w-4" />,
      color: "text-warm-400",
    },
    {
      label: "Total Reactions",
      value: summary.total_reactions.toLocaleString(),
      icon: <Heart className="h-4 w-4" />,
      color: "text-warm-500",
    },
    {
      label: "Total Comments",
      value: summary.total_comments.toLocaleString(),
      icon: <MessageSquare className="h-4 w-4" />,
      color: "text-warm-600",
    },
    {
      label: "Engagement Rate",
      value: `${summary.avg_engagement_rate}%`,
      icon: <TrendingUp className="h-4 w-4" />,
      color: "text-green-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl tracking-tight text-[#1a1a1a] mb-1">
            LinkedIn <span className="gradient-text">Analytics</span>
          </h2>
          <p className="text-sm text-gray-500">
            Track your engagement, followers, and post performance over time.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5 border border-gray-200 rounded-full disabled:opacity-50"
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
              <span className="text-xs text-gray-500">
                {card.label}
              </span>
            </div>
            <p className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Follower trend chart */}
      {followerData.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-warm-500" />
            <h3 className="text-sm font-medium text-[#1a1a1a]">Followers Over Time</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={followerChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Line
                type="monotone"
                dataKey="followers"
                stroke="#966056"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Impressions Over Time */}
      {trendData.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-warm-400" />
            <h3 className="text-sm font-medium text-[#1a1a1a]">Impressions Over Time</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendChartData}>
              <defs>
                <linearGradient id="impressionsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c69f87" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#c69f87" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip
                contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px" }}
              />
              <Area type="monotone" dataKey="impressions" stroke="#c69f87" fill="url(#impressionsFill)" strokeWidth={2} name="Impressions" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Engagement Over Time (reactions, comments, reposts) */}
      {trendData.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-warm-500" />
            <h3 className="text-sm font-medium text-[#1a1a1a]">Engagement Over Time</h3>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip
                contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px" }}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Line type="monotone" dataKey="reactions" stroke="#966056" strokeWidth={2} dot={{ r: 2 }} name="Reactions" />
              <Line type="monotone" dataKey="comments" stroke="#69494a" strokeWidth={2} dot={{ r: 2 }} name="Comments" />
              <Line type="monotone" dataKey="reposts" stroke="#c69f87" strokeWidth={2} dot={{ r: 2 }} name="Reposts" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Engagement Rate Trend */}
      {trendData.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <h3 className="text-sm font-medium text-[#1a1a1a]">Engagement Rate Trend</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendChartData}>
              <defs>
                <linearGradient id="engRateFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} unit="%" />
              <Tooltip
                contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "12px" }}
                formatter={(value: number | undefined) => [`${value ?? 0}%`, "Engagement Rate"]}
              />
              <Area type="monotone" dataKey="engagement_rate" stroke="#10b981" fill="url(#engRateFill)" strokeWidth={2} name="Eng. Rate" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Post performance chart */}
      {postData.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-warm-500" />
            <h3 className="text-sm font-medium text-[#1a1a1a]">Post Performance</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={postData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="impressions" fill="#c69f87" radius={[4, 4, 0, 0]} name="Views" />
              <Bar dataKey="reactions" fill="#966056" radius={[4, 4, 0, 0]} name="Reactions" />
              <Bar dataKey="comments" fill="#69494a" radius={[4, 4, 0, 0]} name="Comments" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top posts table */}
      {(data?.top_posts || []).length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <h3 className="text-sm font-medium text-[#1a1a1a]">Top Performing Posts</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">
                    Post
                  </th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">
                    <Eye className="h-3 w-3 inline" /> Views
                  </th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">
                    <Heart className="h-3 w-3 inline" /> Reactions
                  </th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">
                    <MessageSquare className="h-3 w-3 inline" /> Comments
                  </th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">
                    <Repeat2 className="h-3 w-3 inline" /> Reposts
                  </th>
                </tr>
              </thead>
              <tbody>
                {(data?.top_posts || []).map((post) => (
                  <tr
                    key={post.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="py-2 px-2 max-w-[250px]">
                      <p className="truncate text-[#1a1a1a]">
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
          <TrendingUp className="h-8 w-8 mx-auto text-gray-300" />
          <p className="text-sm text-gray-400">
            No analytics data yet. Click &quot;Refresh Data&quot; to fetch your latest LinkedIn metrics,
            or wait for the daily automatic snapshot.
          </p>
        </div>
      )}
    </div>
  );
}
