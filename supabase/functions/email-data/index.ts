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
    const action = url.searchParams.get("action") || "inbox";

    if (action === "inbox") {
      return await handleInbox(client, userId, url);
    } else if (action === "detail") {
      return await handleDetail(client, userId, url);
    } else if (action === "preferences") {
      return await handlePreferences(client, userId);
    }

    return errorResponse("Invalid action. Use: inbox, detail, preferences", 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    const status = msg === "Unauthorized" || msg.includes("Authorization") ? 401 : 500;
    return errorResponse(msg, status);
  }
});

async function handleInbox(
  client: ReturnType<typeof createUserClient>,
  userId: string,
  url: URL,
): Promise<Response> {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("page_size") || "20")));
  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const offset = (page - 1) * pageSize;

  let query = client
    .from("emails")
    .select(
      "id, from_name, from_email, to_email, subject, category, action_items, priority, status, auto_reply_eligible, has_attachments, received_at, created_at",
      { count: "exact" },
    )
    .eq("user_id", userId)
    .order("received_at", { ascending: false });

  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);
  if (priority) query = query.eq("priority", priority);

  const { data, count, error } = await query.range(offset, offset + pageSize - 1);

  if (error) return errorResponse(error.message, 500);

  const total = count ?? (data?.length ?? 0);
  return jsonResponse(
    {
      items: data ?? [],
      total,
      page,
      page_size: pageSize,
      has_next: total > page * pageSize,
    },
    corsHeaders,
  );
}

async function handleDetail(
  client: ReturnType<typeof createUserClient>,
  userId: string,
  url: URL,
): Promise<Response> {
  const emailId = url.searchParams.get("id");
  if (!emailId) return errorResponse("Missing id parameter", 400);

  // Fetch email and draft in parallel
  const [emailResult, draftResult] = await Promise.all([
    client
      .from("emails")
      .select("*")
      .eq("id", emailId)
      .eq("user_id", userId)
      .single(),
    client
      .from("email_drafts")
      .select("*")
      .eq("email_id", emailId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (emailResult.error || !emailResult.data) {
    return errorResponse("Email not found", 404);
  }

  const emailData = emailResult.data;
  emailData.draft = draftResult.data?.[0] ?? null;

  return jsonResponse(emailData, corsHeaders);
}

async function handlePreferences(
  client: ReturnType<typeof createUserClient>,
  userId: string,
): Promise<Response> {
  const { data, error } = await client
    .from("users")
    .select("email_auto_send_categories")
    .eq("id", userId)
    .single();

  if (error) return errorResponse(error.message, 500);

  return jsonResponse(
    { auto_send_categories: data?.email_auto_send_categories ?? [] },
    corsHeaders,
  );
}
