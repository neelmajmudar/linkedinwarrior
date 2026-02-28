"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { usePersona, useLinkedinStatus } from "@/lib/queries";
import dynamic from "next/dynamic";
import { TaskNotificationProvider, useTaskNotifications } from "@/components/task-notifications";
import type { Session } from "@supabase/supabase-js";
import {
  Sword,
  PenTool,
  FileText,
  Calendar,
  LogOut,
  Linkedin,
  MessageSquare,
  BarChart3,
  Loader2,
  Sparkles,
} from "lucide-react";

const AuthPage = dynamic(() => import("@/components/auth-page"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-warm-500 flex items-center justify-center animate-pulse-glow">
          <Sword className="h-5 w-5 text-white" />
        </div>
        <div className="skeleton h-2 w-24 rounded-full" />
      </div>
    </div>
  ),
});
const Onboarding = dynamic(() => import("@/components/onboarding"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-warm-500 flex items-center justify-center animate-pulse-glow">
          <Sword className="h-5 w-5 text-white" />
        </div>
        <div className="skeleton h-2 w-24 rounded-full" />
      </div>
    </div>
  ),
});

const tabs = [
  { id: "generate", label: "Generate", icon: PenTool, href: "/dashboard/generate" },
  { id: "posts", label: "My Posts", icon: FileText, href: "/dashboard/posts" },
  { id: "calendar", label: "Calendar", icon: Calendar, href: "/dashboard/calendar" },
  { id: "engage", label: "Engage", icon: MessageSquare, href: "/dashboard/engage" },
  { id: "research", label: "Research", icon: Sparkles, href: "/dashboard/research" },
  { id: "analytics", label: "Analytics", icon: BarChart3, href: "/dashboard/analytics" },
];

// ── Auth hook ──
// We use a synchronous localStorage peek ONLY to decide whether to show
// the branded skeleton (likely logged-in) vs nothing at all.
// We always wait for the authoritative supabase.auth.getSession() before
// rendering the real shell, to avoid cascading failures from stale tokens.

function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  // Peek at localStorage synchronously to hint whether a session is likely
  const [hasHint] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem("linkedinwarrior-auth");
      if (raw) {
        const parsed = JSON.parse(raw);
        const s = parsed?.currentSession ?? parsed;
        return !!(s?.access_token && s?.user);
      }
    } catch {
      // ignore
    }
    return false;
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setChecked(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setChecked(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, checked, hasHint };
}

// ── Main layout ──

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, checked, hasHint } = useSession();

  // Auth hasn't resolved yet — show the appropriate skeleton
  if (!checked) {
    // If localStorage hints there's a session, show the dashboard skeleton
    // (header + nav + placeholder content). Otherwise show a minimal loader.
    return hasHint ? <DashboardSkeleton /> : <DashboardSkeleton />;
  }

  if (!session) {
    return <AuthPage />;
  }

  return (
    <TaskNotificationProvider>
      <DashboardShell>{children}</DashboardShell>
    </TaskNotificationProvider>
  );
}

// ── Instant-paint skeleton: header + nav + content placeholder ──

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-warm-500 flex items-center justify-center">
            <Sword className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg tracking-tight text-[#1a1a1a]">
            LinkedInWarrior
          </span>
        </div>
        <div className="skeleton h-8 w-36 rounded-full" />
      </header>
      <nav className="border-b border-gray-200 px-6 bg-white">
        <div className="max-w-4xl mx-auto flex gap-1 py-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-5 w-20 rounded" />
          ))}
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-4">
          <div className="skeleton h-8 w-48 rounded" />
          <div className="skeleton h-4 w-72 rounded" />
          <div className="skeleton h-32 w-full rounded-lg" />
        </div>
      </main>
    </div>
  );
}

// ── Dashboard shell: renders header + nav IMMEDIATELY, gates only <main> content ──

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setNavigateTo } = useTaskNotifications();
  const personaQuery = usePersona();
  const linkedinQuery = useLinkedinStatus();
  const [connecting, setConnecting] = useState(false);

  const linkedinConnected = linkedinQuery.data?.connected ?? false;

  // Derive onboarding status — memo to avoid re-render jitter
  const onboardingStatus = useMemo<"loading" | "needed" | "done">(() => {
    if (personaQuery.isLoading) return "loading";
    if (personaQuery.isError) return "needed";
    if (personaQuery.data && !personaQuery.data.voice_profile) return "needed";
    return "done";
  }, [personaQuery.isLoading, personaQuery.isError, personaQuery.data]);

  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const showOnboarding = onboardingStatus === "needed" && !onboardingDismissed;

  // Register router-based navigation for task notification toasts
  const navigateToTab = useCallback(
    (t: string) => {
      const route =
        t === "generate"
          ? "/dashboard/generate"
          : t === "engage"
          ? "/dashboard/engage"
          : t === "research"
          ? "/dashboard/research"
          : `/dashboard/${t}`;
      router.push(route);
    },
    [router]
  );

  useEffect(() => {
    setNavigateTo(navigateToTab);
  }, [setNavigateTo, navigateToTab]);

  // Listen for LinkedIn auth popup callback
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "linkedin-connected") {
        linkedinQuery.refetch();
        setConnecting(false);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [linkedinQuery]);

  async function connectLinkedin() {
    setConnecting(true);
    try {
      const data = await apiPost<{ auth_url: string }>("/api/linkedin/connect");
      if (data.auth_url) {
        const w = 600, h = 700;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        window.open(
          data.auth_url,
          "linkedin-auth",
          `width=${w},height=${h},left=${left},top=${top}`
        );
      }
    } catch (err) {
      console.error("Failed to start LinkedIn connection:", err);
      setConnecting(false);
    }
  }

  // Determine what to show in the content area
  const mainContent = (() => {
    if (onboardingStatus === "loading") {
      return (
        <div className="space-y-4 animate-fade-in">
          <div className="skeleton h-8 w-48 rounded" />
          <div className="skeleton h-4 w-72 rounded" />
          <div className="skeleton h-32 w-full rounded-lg" />
        </div>
      );
    }
    if (showOnboarding) {
      return (
        <div className="animate-fade-in">
          <Onboarding onComplete={() => setOnboardingDismissed(true)} />
        </div>
      );
    }
    return <div className="animate-fade-in">{children}</div>;
  })();

  return (
    <div className="min-h-screen bg-white">
      {/* Header — paints immediately, no async dependency */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-warm-500 flex items-center justify-center">
            <Sword className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg tracking-tight text-[#1a1a1a]">
            LinkedInWarrior
          </span>
        </a>
        <div className="flex items-center gap-4">
          {linkedinConnected ? (
            <div className="flex items-center gap-1.5 text-sm">
              <Linkedin className="h-4 w-4 text-green-600" />
              <span className="text-green-700 font-medium">Connected</span>
            </div>
          ) : (
            <button
              onClick={connectLinkedin}
              disabled={connecting}
              className="flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-full bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors disabled:opacity-50"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Linkedin className="h-4 w-4" />
              )}
              {connecting ? "Connecting…" : "Connect LinkedIn"}
            </button>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Tab navigation — always visible */}
      {!showOnboarding && (
        <nav className="border-b border-gray-200 px-6 bg-white">
          <div className="max-w-4xl mx-auto flex gap-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = pathname === t.href || (t.href === "/dashboard/generate" && pathname === "/dashboard");
              return (
                <Link
                  key={t.id}
                  href={t.href}
                  prefetch
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                    isActive
                      ? "border-[#1a1a1a] text-[#1a1a1a]"
                      : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}

      {/* Content */}
      <main className={showOnboarding ? "" : "max-w-4xl mx-auto px-6 py-8"}>
        {mainContent}
      </main>
    </div>
  );
}
