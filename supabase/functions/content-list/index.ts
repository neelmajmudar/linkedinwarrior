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
    const orgId = url.searchParams.get("org_id");
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get("page_size") || "10")));
    const offset = (page - 1) * pageSize;

    // Count query — scope by org_id or user_id
    let countQuery = client
      .from("content_items")
      .select("id", { count: "exact", head: true });
    if (orgId) {
      countQuery = countQuery.eq("org_id", orgId);
    } else {
      countQuery = countQuery.eq("user_id", userId);
    }
    if (status) countQuery = countQuery.eq("status", status);
    if (excludeStatus) countQuery = countQuery.neq("status", excludeStatus);
    const { count } = await countQuery;
    const total = count ?? 0;

    // Data query
    let dataQuery = client
      .from("content_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (orgId) {
      dataQuery = dataQuery.eq("org_id", orgId);
    } else {
      dataQuery = dataQuery.eq("user_id", userId);
    }
    if (status) dataQuery = dataQuery.eq("status", status);
    if (excludeStatus) dataQuery = dataQuery.neq("status", excludeStatus);
    const { data, error } = await dataQuery.range(offset, offset + pageSize - 1);

    if (error) return errorResponse(error.message, 500);

    // If org mode, enrich with member display info
    let items = data ?? [];
    if (orgId && items.length > 0) {
      const { data: members } = await client
        .from("org_members")
        .select("user_id, display_name, color")
        .eq("org_id", orgId);
      const memberMap: Record<string, { display_name: string | null; color: string | null }> = {};
      for (const m of members ?? []) {
        memberMap[m.user_id] = m;
      }
      items = items.map((item: Record<string, unknown>) => {
        const m = memberMap[(item.user_id as string) || ""] || {};
        return {
          ...item,
          member_display_name: m.display_name ?? null,
          member_color: m.color ?? null,
          member_user_id: item.user_id,
        };
      });
    }

    return jsonResponse(
      {
        items,
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
