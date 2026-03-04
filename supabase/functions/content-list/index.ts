import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createUserClient, getUserId, errorResponse, jsonResponse } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const client = createUserClient(req);
    const userId = await getUserId(client);

    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const excludeStatus = url.searchParams.get("exclude_status");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "10")));
    const offset = (page - 1) * pageSize;

    // Count query
    let countQuery = client
      .from("content_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (status) countQuery = countQuery.eq("status", status);
    if (excludeStatus) countQuery = countQuery.neq("status", excludeStatus);
    const { count } = await countQuery;
    const total = count ?? 0;

    // Data query
    let dataQuery = client
      .from("content_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (status) dataQuery = dataQuery.eq("status", status);
    if (excludeStatus) dataQuery = dataQuery.neq("status", excludeStatus);
    const { data, error } = await dataQuery.range(offset, offset + pageSize - 1);

    if (error) return errorResponse(error.message, 500);

    return jsonResponse(
      {
        items: data ?? [],
        total,
        page,
        page_size: pageSize,
        has_next: offset + pageSize < total,
      },
      corsHeaders,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    const status = msg === "Unauthorized" || msg.includes("Authorization") ? 401 : 500;
    return errorResponse(msg, status);
  }
});
