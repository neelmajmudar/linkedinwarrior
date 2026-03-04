import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createUserClient, getUserId, errorResponse, jsonResponse } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const client = createUserClient(req);
    const userId = await getUserId(client);

    // Run all queries in parallel for maximum speed
    const [followersResult, postAnalyticsResult] = await Promise.all([
      client
        .from("analytics_snapshots")
        .select("followers_count, snapshot_date")
        .eq("user_id", userId)
        .order("snapshot_date", { ascending: true })
        .limit(90),
      client
        .from("post_analytics")
        .select("*")
        .eq("user_id", userId)
        .order("snapshot_date", { ascending: false })
        .limit(200),
    ]);

    const followers = followersResult.data ?? [];
    const allPosts = postAnalyticsResult.data ?? [];

    // --- Deduplicated top posts (latest snapshot per post, sorted by impressions) ---
    const seenPosts = new Set<string>();
    const uniquePosts: typeof allPosts = [];
    for (const row of allPosts) {
      const pid = row.linkedin_post_id;
      if (pid && !seenPosts.has(pid)) {
        seenPosts.add(pid);
        uniquePosts.push(row);
      }
    }
    uniquePosts.sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0));
    const topPosts = uniquePosts.slice(0, 20);

    // --- Engagement summary from top 50 posts ---
    const summaryPosts = uniquePosts.slice(0, 50);
    const totalReactions = summaryPosts.reduce((s, p) => s + (p.reactions ?? 0), 0);
    const totalComments = summaryPosts.reduce((s, p) => s + (p.comments ?? 0), 0);
    const totalReposts = summaryPosts.reduce((s, p) => s + (p.reposts ?? 0), 0);
    const totalImpressions = summaryPosts.reduce((s, p) => s + (p.impressions ?? 0), 0);
    const engagementRate =
      totalImpressions > 0
        ? Math.round(((totalReactions + totalComments + totalReposts) / totalImpressions) * 10000) / 100
        : 0;

    const summary = {
      total_posts: summaryPosts.length,
      total_reactions: totalReactions,
      total_comments: totalComments,
      total_reposts: totalReposts,
      total_impressions: totalImpressions,
      avg_engagement_rate: engagementRate,
    };

    // --- Metric trends (aggregate by snapshot_date) ---
    const daily: Record<string, {
      date: string;
      impressions: number;
      reactions: number;
      comments: number;
      reposts: number;
      post_count: number;
      engagement_rate: number;
    }> = {};

    for (const row of allPosts) {
      const d = row.snapshot_date;
      if (!d) continue;
      if (!daily[d]) {
        daily[d] = { date: d, impressions: 0, reactions: 0, comments: 0, reposts: 0, post_count: 0, engagement_rate: 0 };
      }
      daily[d].impressions += row.impressions ?? 0;
      daily[d].reactions += row.reactions ?? 0;
      daily[d].comments += row.comments ?? 0;
      daily[d].reposts += row.reposts ?? 0;
      daily[d].post_count += 1;
    }

    const sortedDays = Object.values(daily).sort((a, b) => a.date.localeCompare(b.date));
    for (const day of sortedDays) {
      const totalEng = day.reactions + day.comments + day.reposts;
      day.engagement_rate = day.impressions > 0 ? Math.round((totalEng / day.impressions) * 10000) / 100 : 0;
    }
    const metricTrends = sortedDays.slice(-90);

    return jsonResponse(
      {
        summary,
        follower_history: followers,
        top_posts: topPosts,
        metric_trends: metricTrends,
      },
      corsHeaders,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    const status = msg === "Unauthorized" || msg.includes("Authorization") ? 401 : 500;
    return errorResponse(msg, status);
  }
});
