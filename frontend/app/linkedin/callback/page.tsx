"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiPost } from "@/lib/api";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function LinkedInCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <LinkedInCallbackInner />
    </Suspense>
  );
}

function LinkedInCallbackInner() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function handleCallback() {
      const accountId = searchParams.get("account_id");
      if (!accountId) {
        setStatus("error");
        setErrorMsg("No account_id received from Unipile.");
        return;
      }

      try {
        await apiPost("/api/linkedin/callback", { account_id: accountId });
        setStatus("success");

        // Notify the parent (dashboard) window that LinkedIn is connected
        if (window.opener) {
          window.opener.postMessage({ type: "linkedin-connected" }, "*");
          setTimeout(() => window.close(), 1500);
        }
      } catch (err: unknown) {
        setStatus("error");
        setErrorMsg(
          err instanceof Error ? err.message : "Failed to complete connection."
        );
      }
    }

    handleCallback();
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4 text-center p-8">
        {status === "loading" && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
            <p className="text-[var(--muted-foreground)]">
              Connecting your LinkedIn account…
            </p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-8 w-8 text-[var(--success)]" />
            <p className="text-[var(--success)] font-medium">
              LinkedIn connected successfully!
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">
              This window will close automatically.
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-8 w-8 text-red-500" />
            <p className="text-red-500 font-medium">Connection failed</p>
            <p className="text-sm text-[var(--muted-foreground)]">{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  );
}
