"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAcceptInvite } from "@/lib/queries";
import { Loader2, CheckCircle2, XCircle, Building2 } from "lucide-react";

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <div className="section-card p-10 text-center space-y-4 max-w-md">
            <div className="w-14 h-14 rounded-xl bg-warm-50 flex items-center justify-center mx-auto">
              <Loader2 className="h-6 w-6 animate-spin text-warm-500" />
            </div>
            <h2 className="text-lg font-medium text-[#1a1a1a]">Loading...</h2>
          </div>
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}

function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const acceptInvite = useAcceptInvite();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "no-token">(
    token ? "loading" : "no-token"
  );
  const [errorMsg, setErrorMsg] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        <div className="section-card p-10 text-center space-y-4 max-w-md">
          <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center mx-auto">
            <XCircle className="h-6 w-6 text-red-400" />
          </div>
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
        <div className="section-card p-10 text-center space-y-4 max-w-md">
          <div className="w-14 h-14 rounded-xl bg-warm-50 flex items-center justify-center mx-auto">
            <Loader2 className="h-6 w-6 animate-spin text-warm-500" />
          </div>
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
        <div className="section-card p-10 text-center space-y-4 max-w-md">
          <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center mx-auto">
            <XCircle className="h-6 w-6 text-red-400" />
          </div>
          <h2 className="text-lg font-medium text-[#1a1a1a]">Invite Failed</h2>
          <p className="text-sm text-gray-500">{errorMsg}</p>
          <button
            onClick={() => router.push("/dashboard/team")}
            className="btn-primary px-4 py-2 text-sm"
          >
            Go to Team
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-16">
      <div className="section-card p-10 text-center space-y-4 max-w-md">
        <div className="w-14 h-14 rounded-xl bg-green-50 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        </div>
        <h2 className="text-lg font-medium text-[#1a1a1a]">You&apos;re In!</h2>
        <p className="text-sm text-gray-500">
          You&apos;ve successfully joined the team. You can now see the shared calendar and collaborate with your team.
        </p>
        <button
          onClick={() => router.push("/dashboard/team")}
          className="btn-primary px-4 py-2 text-sm flex items-center gap-2 mx-auto"
        >
          <Building2 className="h-4 w-4" />
          View Team
        </button>
      </div>
    </div>
  );
}
