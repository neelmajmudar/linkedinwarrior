const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { supabase } = await import("./supabase");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${API_URL}${path}`, { headers, signal: controller.signal });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || res.statusText);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function apiPost<T = unknown>(
  path: string,
  body?: unknown
): Promise<T> {
  const headers = await getAuthHeaders();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || res.statusText);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function apiPatch<T = unknown>(
  path: string,
  body: unknown
): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

export async function apiDelete(path: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
}

export async function apiStream(
  path: string,
  body: unknown,
  onToken: (token: string) => void,
  onDone: () => void
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") {
        onDone();
        return;
      }
      try {
        const parsed = JSON.parse(data);
        if (parsed.token) onToken(parsed.token);
      } catch {
        // skip malformed lines
      }
    }
  }
  onDone();
}

/**
 * Call a Supabase Edge Function for low-latency reads.
 * Falls back to the regular backend API if SUPABASE_URL is not configured.
 */
export async function edgeGet<T = unknown>(
  functionName: string,
  params?: Record<string, string>,
  backendPath?: string
): Promise<T> {
  // Fallback to backend if edge functions aren't configured
  if (!SUPABASE_URL) {
    if (backendPath) return apiGet<T>(backendPath);
    throw new Error("Edge functions not configured and no fallback path");
  }

  const { supabase } = await import("./supabase");
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const url = new URL(`${SUPABASE_URL}/functions/v1/${functionName}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, value);
      }
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      // On edge function failure, fall back to backend
      if (backendPath) return apiGet<T>(backendPath);
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || err.detail || res.statusText);
    }
    return res.json();
  } catch (e) {
    // Network errors / timeouts -> fall back to backend
    if (backendPath) return apiGet<T>(backendPath);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
