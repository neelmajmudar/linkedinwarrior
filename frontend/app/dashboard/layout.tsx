"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { apiPost } from "@/lib/api";
import { usePersona, useLinkedinStatus, useGmailStatus } from "@/lib/queries";
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
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
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

const linkedinTabs = [
  { id: "generate", label: "Generate", icon: PenTool, href: "/dashboard/generate" },
  { id: "posts", label: "My Posts", icon: FileText, href: "/dashboard/posts" },
  { id: "calendar", label: "Calendar", icon: Calendar, href: "/dashboard/calendar" },
  { id: "engage", label: "Engage", icon: MessageSquare, href: "/dashboard/engage" },
  { id: "research", label: "Research", icon: Sparkles, href: "/dashboard/research" },
  { id: "analytics", label: "Analytics", icon: BarChart3, href: "/dashboard/analytics" },
];

const emailTabs = [
  { id: "email", label: "Email", icon: Mail, href: "/dashboard/email" },
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

// ── Instant-paint skeleton: sidebar + content placeholder ──

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar skeleton */}
      <aside className="w-56 border-r border-gray-200 bg-white flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-warm-500 flex items-center justify-center">
              <Sword className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg tracking-tight text-[#1a1a1a]">LinkedInWarrior</span>
          </div>
        </div>
        <div className="p-3 space-y-2">
          <div className="skeleton h-3 w-16 rounded mb-2" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-full rounded" />
          ))}
          <div className="my-3 border-t border-gray-200" />
          <div className="skeleton h-3 w-12 rounded mb-2" />
          <div className="skeleton h-8 w-full rounded" />
        </div>
      </aside>
      {/* Content skeleton */}
      <div className="flex-1">
        <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-end">
          <div className="skeleton h-8 w-36 rounded-full" />
        </header>
        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="space-y-4">
            <div className="skeleton h-8 w-48 rounded" />
            <div className="skeleton h-4 w-72 rounded" />
            <div className="skeleton h-32 w-full rounded-lg" />
          </div>
        </main>
      </div>
    </div>
  );
}

// ── Sidebar nav link ──

function SidebarLink({
  tab,
  isActive,
  collapsed,
}: {
  tab: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; href: string };
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      prefetch
      title={collapsed ? tab.label : undefined}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        isActive
          ? "bg-[#1a1a1a] text-white"
          : "text-gray-500 hover:text-[#1a1a1a] hover:bg-gray-100"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      {!collapsed && <span>{tab.label}</span>}
    </Link>
  );
}

// ── Dashboard shell: renders sidebar + header + content ──

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { setNavigateTo } = useTaskNotifications();
  const personaQuery = usePersona();
  const linkedinQuery = useLinkedinStatus();
  const gmailQuery = useGmailStatus();
  const [connecting, setConnecting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const linkedinConnected = linkedinQuery.data?.connected ?? false;
  const gmailConnected = gmailQuery.data?.connected ?? false;

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
    <div className="min-h-screen bg-white flex">
      {/* ── Sidebar ── */}
      <aside
        className={`fixed top-0 left-0 h-full z-40 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out ${
          sidebarOpen ? "w-56" : "w-[52px]"
        }`}
      >
        {/* Logo + toggle */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200">
          {sidebarOpen && (
            <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-warm-500 flex items-center justify-center flex-shrink-0">
                <Sword className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-base tracking-tight text-[#1a1a1a] font-medium whitespace-nowrap">
                LinkedInWarrior
              </span>
            </a>
          )}
          <button
            onClick={() => setSidebarOpen((p) => !p)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Nav sections */}
        {!showOnboarding && (
          <nav className="flex-1 overflow-y-auto px-2 py-3">
            {/* LinkedIn section */}
            {sidebarOpen && (
              <div className="px-2 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  LinkedIn
                </span>
              </div>
            )}
            {!sidebarOpen && (
              <div className="flex justify-center mb-1.5">
                <Linkedin className="h-3.5 w-3.5 text-gray-400" />
              </div>
            )}
            <div className="space-y-0.5">
              {linkedinTabs.map((t) => {
                const isActive = pathname === t.href || (t.href === "/dashboard/generate" && pathname === "/dashboard");
                return <SidebarLink key={t.id} tab={t} isActive={isActive} collapsed={!sidebarOpen} />;
              })}
            </div>

            {/* Separator */}
            <div className="my-3 mx-2 border-t border-gray-200" />

            {/* Email section */}
            {sidebarOpen && (
              <div className="px-2 mb-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Email
                </span>
              </div>
            )}
            {!sidebarOpen && (
              <div className="flex justify-center mb-1.5">
                <Mail className="h-3.5 w-3.5 text-gray-400" />
              </div>
            )}
            <div className="space-y-0.5">
              {emailTabs.map((t) => {
                const isActive = pathname === t.href;
                return <SidebarLink key={t.id} tab={t} isActive={isActive} collapsed={!sidebarOpen} />;
              })}
            </div>
          </nav>
        )}

        {/* Bottom: connection status + sign out */}
        <div className="border-t border-gray-200 px-2 py-3 space-y-1">
          {linkedinConnected ? (
            <div className={`flex items-center gap-2 px-3 py-1.5 text-sm ${!sidebarOpen ? "justify-center" : ""}`}>
              <Linkedin className="h-4 w-4 text-green-600 flex-shrink-0" />
              {sidebarOpen && <span className="text-green-700 font-medium text-xs">Connected</span>}
            </div>
          ) : (
            <button
              onClick={connectLinkedin}
              disabled={connecting}
              title={!sidebarOpen ? (connecting ? "Connecting…" : "Connect LinkedIn") : undefined}
              className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors disabled:opacity-50 w-full ${
                !sidebarOpen ? "justify-center" : ""
              }`}
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              ) : (
                <Linkedin className="h-4 w-4 flex-shrink-0" />
              )}
              {sidebarOpen && <span className="text-xs">{connecting ? "Connecting…" : "Connect LinkedIn"}</span>}
            </button>
          )}
          {gmailConnected && (
            <div className={`flex items-center gap-2 px-3 py-1.5 text-sm ${!sidebarOpen ? "justify-center" : ""}`}>
              <Mail className="h-4 w-4 text-green-600 flex-shrink-0" />
              {sidebarOpen && <span className="text-green-700 font-medium text-xs">Gmail</span>}
            </div>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            title="Sign out"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors w-full ${
              !sidebarOpen ? "justify-center" : ""
            }`}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {sidebarOpen && <span className="text-xs">Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content area ── */}
      <div
        className={`flex-1 min-h-screen transition-all duration-300 ease-in-out ${
          sidebarOpen ? "ml-56" : "ml-[52px]"
        }`}
      >
        <main className={showOnboarding ? "" : "max-w-4xl mx-auto px-6 py-8"}>
          {mainContent}
        </main>
      </div>
    </div>
  );
}
