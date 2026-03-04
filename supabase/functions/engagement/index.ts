import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createUserClient, getUserId, errorResponse, jsonResponse } from "../_shared/supabase.ts";

const DAILY_COMMENT_LIMIT = 15;

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const client = createUserClient(req);
    const userId = await getUserId(client);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "topics";

    if (action === "topics") {
      return await handleTopics(client, userId);
    } else if (action === "remaining") {
      return await handleRemaining(client, userId);
    } else if (action === "history") {
      return await handleHistory(client, userId, url);
    }

    return errorResponse("Invalid action. Use: topics, remaining, history", 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    const status = msg === "Unauthorized" || msg.includes("Authorization") ? 401 : 500;
    return errorResponse(msg, status);
  }
});

async function handleTopics(
  client: ReturnType<typeof createUserClient>,
  userId: string,
): Promise<Response> {
  const { data, error } = await client
    .from("users")
    .select("engagement_topics")
    .eq("id", userId)
    .single();

  if (error) return errorResponse(error.message, 500);
  return jsonResponse({ topics: data?.engagement_topics ?? [] }, corsHeaders);
}

async function handleRemaining(
  client: ReturnType<typeof createUserClient>,
  userId: string,
): Promise<Response> {
  const today = new Date().toISOString().split("T")[0];
  const { count } = await client
    .from("auto_comments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "posted")
    .gte("created_at", `${today}T00:00:00Z`);

  const used = count ?? 0;
  return jsonResponse(
    {
      remaining_today: Math.max(0, DAILY_COMMENT_LIMIT - used),
      daily_limit: DAILY_COMMENT_LIMIT,
    },
    corsHeaders,
  );
}

async function handleHistory(
  client: ReturnType<typeof createUserClient>,
  userId: string,
  url: URL,
): Promise<Response> {
  const status = url.searchParams.get("status");
  const excludeStatus = url.searchParams.get("exclude_status");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "10")));
  const offset = (page - 1) * pageSize;

  // Count
  let countQuery = client
    .from("auto_comments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (status) countQuery = countQuery.eq("status", status);
  if (excludeStatus) countQuery = countQuery.neq("status", excludeStatus);
  const { count } = await countQuery;
  const total = count ?? 0;

  // Data
  let dataQuery = client
    .from("auto_comments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (status) dataQuery = dataQuery.eq("status", status);
  if (excludeStatus) dataQuery = dataQuery.neq("status", excludeStatus);
  const { data, error } = await dataQuery.range(offset, offset + pageSize - 1);

  if (error) return errorResponse(error.message, 500);

  // Remaining count
  const today = new Date().toISOString().split("T")[0];
  const { count: usedCount } = await client
    .from("auto_comments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "posted")
    .gte("created_at", `${today}T00:00:00Z`);

  const used = usedCount ?? 0;

  return jsonResponse(
    {
      comments: data ?? [],
      total,
      page,
      page_size: pageSize,
      has_next: offset + pageSize < total,
      remaining_today: Math.max(0, DAILY_COMMENT_LIMIT - used),
      daily_limit: DAILY_COMMENT_LIMIT,
    },
    corsHeaders,
  );
}
