import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createUserClient, getUserId, errorResponse, jsonResponse } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const client = createUserClient(req);
    const userId = await getUserId(client);

    const { data, error } = await client
      .from("users")
      .select("voice_profile, linkedin_username")
      .eq("id", userId)
      .single();

    if (error || !data) {
      return errorResponse("User profile not found", 404);
    }

    return jsonResponse(data, corsHeaders);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    const status = msg === "Unauthorized" || msg.includes("Authorization") ? 401 : 500;
    return errorResponse(msg, status);
  }
});
