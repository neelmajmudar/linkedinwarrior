"use client";

import { useState } from "react";
import {
  useAnalytics,
  useRefreshAnalytics,
  usePostInteractions,
  useSendConnectionRequest,
} from "@/lib/queries";
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
  ExternalLink,
  UserCircle,
  UserPlus,
  Check,
  AlertCircle,
  X,
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

function InteractionBadge({ type }: { type: string }) {
  if (type === "both")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700">
        <Heart className="h-2.5 w-2.5" />
        <MessageSquare className="h-2.5 w-2.5" />
        Both
      </span>
    );
  if (type === "comment")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
        <MessageSquare className="h-2.5 w-2.5" />
        Comment
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-warm-50 text-warm-700">
      <Heart className="h-2.5 w-2.5" />
      Reaction
    </span>
  );
}

function ConnectButton({ providerId }: { providerId: string }) {
  const connectMutation = useSendConnectionRequest();
  const [sent, setSent] = useState(false);

  if (sent || connectMutation.isSuccess)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-green-600 font-medium px-2 py-1">
        <Check className="h-3 w-3" /> Sent
      </span>
    );

  if (connectMutation.isError)
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-red-500 font-medium px-2 py-1" title={String(connectMutation.error)}>
        <AlertCircle className="h-3 w-3" /> Failed
      </span>
    );

  return (
    <button
      onClick={() => {
        connectMutation.mutate({ provider_id: providerId }, { onSuccess: () => setSent(true) });
      }}
      disabled={connectMutation.isPending || !providerId}
      className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full border border-warm-300 text-warm-700 hover:bg-warm-50 transition-colors disabled:opacity-40"
    >
      {connectMutation.isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <UserPlus className="h-3 w-3" />
      )}
      Connect
    </button>
  );
}

function PostInteractionsSection({
  postId,
  postText,
  onClose,
}: {
  postId: string;
  postText: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error } = usePostInteractions(postId);

  const profiles = data?.profiles || [];
  const hasError = data?.error || data?.api_errors?.length;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-warm-500 flex-shrink-0" />
            <h3 className="text-sm font-medium text-[#1a1a1a]">Post Interactions</h3>
          </div>
          <p className="text-xs text-gray-400 truncate max-w-md">
            {postText || "Selected post"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-warm-500" />
          <span className="ml-2 text-sm text-gray-400">Fetching interaction data...</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-xs">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Failed to load interactions: {(error as Error)?.message || "Unknown error"}</span>
        </div>
      )}

      {!isLoading && hasError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 text-amber-700 text-xs">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{data?.error || data?.api_errors?.join("; ")}</span>
        </div>
      )}

      {!isLoading && !isError && profiles.length === 0 && !hasError && (
        <div className="py-6 text-center text-sm text-gray-400">
          No interaction data available for this post.
        </div>
      )}

      {profiles.length > 0 && (
        <>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3 text-warm-500" />
              {data?.total_reactors ?? 0} reactors
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3 text-blue-500" />
              {data?.total_commenters ?? 0} commenters
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 text-gray-400" />
              {profiles.length} unique
            </span>
          </div>

          <div className="max-h-[420px] overflow-y-auto space-y-1 pr-1">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                {profile.profile_picture_url ? (
                  <img
                    src={profile.profile_picture_url}
                    alt={profile.name || "Profile"}
                    className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <UserCircle className="h-9 w-9 text-gray-300 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {profile.profile_url ? (
                      <a
                        href={profile.profile_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-[#1a1a1a] hover:text-warm-600 truncate flex items-center gap-1"
                      >
                        {profile.name || "LinkedIn User"}
                        <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs font-medium text-[#1a1a1a] truncate">
                        {profile.name || "LinkedIn User"}
                      </span>
                    )}
                    <InteractionBadge type={profile.interaction_type} />
                  </div>
                  {profile.headline && (
                    <p className="text-[11px] text-gray-400 truncate">{profile.headline}</p>
                  )}
                  {profile.comment_text && (
                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 italic">
                      &ldquo;{profile.comment_text}&rdquo;
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  <ConnectButton providerId={profile.provider_id} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { data, isLoading } = useAnalytics();
  const refreshMutation = useRefreshAnalytics();
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPostText, setSelectedPostText] = useState<string>("");

  if (isLoading) {
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

  // Posts are already sorted by views (impressions) from the backend
  const sortedPosts = [...(data?.top_posts || [])].sort(
    (a, b) => b.impressions - a.impressions
  );

  const postData = sortedPosts
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
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5 border border-gray-200 rounded-full disabled:opacity-50"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {refreshMutation.isPending ? "Refreshing..." : "Refresh Data"}
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

      {/* Top posts table — sorted by views */}
      {sortedPosts.length > 0 && (
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#1a1a1a]">Top Performing Posts</h3>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Eye className="h-3 w-3" /> Sorted by views &middot; Click a row to view interactions
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-500 w-6">
                    #
                  </th>
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
                {sortedPosts.map((post, idx) => {
                  const isSelected = selectedPostId === post.linkedin_post_id;
                  return (
                    <tr
                      key={post.id}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedPostId(null);
                          setSelectedPostText("");
                        } else {
                          setSelectedPostId(post.linkedin_post_id);
                          setSelectedPostText(post.post_text || "");
                        }
                      }}
                      className={`border-b border-gray-100 last:border-0 cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-warm-50/60 border-l-2 border-l-warm-400"
                          : "hover:bg-gray-50/50"
                      }`}
                    >
                      <td className="py-2 px-2 text-xs text-gray-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-2 max-w-[250px]">
                        <p className="truncate text-[#1a1a1a]">
                          {post.post_text || "—"}
                        </p>
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums font-medium">
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
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Post Interactions — dedicated section */}
      {selectedPostId && (
        <PostInteractionsSection
          postId={selectedPostId}
          postText={selectedPostText}
          onClose={() => {
            setSelectedPostId(null);
            setSelectedPostText("");
          }}
        />
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
