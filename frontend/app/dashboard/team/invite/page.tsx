"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAcceptInvite } from "@/lib/queries";
import { Loader2, CheckCircle2, XCircle, Building2 } from "lucide-react";

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const acceptInvite = useAcceptInvite();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">(
    token ? "loading" : "no-token"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const acceptedRef = useRef(false);

  useEffect(() => {
    if (!token || acceptedRef.current) return;
    acceptedRef.current = true;

    async function accept() {
      try {
        const result = await acceptInvite.mutateAsync(token!);
        setOrgId(result.org_id);
        setStatus("success");
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : "Failed to accept invite");
        setStatus("error");
      }
    }

    accept();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (status === "no-token") {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="glass-card p-8 text-center space-y-4 max-w-md">
          <XCircle className="h-10 w-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-medium text-[#1a1a1a]">Invalid Invite Link</h2>
          <p className="text-sm text-gray-500">
            This invite link is missing the required token. Please check the link from your email.
          </p>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="glass-card p-8 text-center space-y-4 max-w-md">
          <Loader2 className="h-10 w-10 animate-spin text-warm-500 mx-auto" />
          <h2 className="text-lg font-medium text-[#1a1a1a]">Accepting Invite...</h2>
          <p className="text-sm text-gray-500">
            Joining the team, just a moment.
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="glass-card p-8 text-center space-y-4 max-w-md">
          <XCircle className="h-10 w-10 text-red-400 mx-auto" />
          <h2 className="text-lg font-medium text-[#1a1a1a]">Invite Failed</h2>
          <p className="text-sm text-gray-500">{errorMsg}</p>
          <button
            onClick={() => router.push("/dashboard/team")}
            className="px-4 py-2 text-sm rounded-full bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors"
          >
            Go to Team
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-16">
      <div className="glass-card p-8 text-center space-y-4 max-w-md">
        <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto" />
        <h2 className="text-lg font-medium text-[#1a1a1a]">You&apos;re In!</h2>
        <p className="text-sm text-gray-500">
          You&apos;ve successfully joined the team. You can now see the shared calendar and collaborate with your team.
        </p>
        <button
          onClick={() => router.push("/dashboard/team")}
          className="flex items-center gap-2 mx-auto px-4 py-2 text-sm rounded-full bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors"
        >
          <Building2 className="h-4 w-4" />
          View Team
        </button>
      </div>
    </div>
  );
}
