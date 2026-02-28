"use client";

import { useState, useEffect, useCallback, memo, useMemo } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";
import Onboarding from "./onboarding";
import PostGenerator from "./post-generator";
import ContentList from "./content-list";
import { TaskNotificationProvider, useTaskNotifications } from "./task-notifications";
import Link from "next/link";
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
  Menu,
  X,
} from "lucide-react";

// Lazy-load heavy tabs — analytics (recharts ~50KB), calendar (date-fns computations), engagement, research
const CalendarView = dynamic(() => import("./calendar-view"), {
  loading: () => <TabSkeleton />,
});
const Engagement = dynamic(() => import("./engagement"), {
  loading: () => <TabSkeleton />,
});
const AnalyticsDashboard = dynamic(() => import("./analytics-dashboard"), {
  loading: () => <TabSkeleton />,
});
const CreatorAnalysis = dynamic(() => import("./creator-analysis"), {
  loading: () => <TabSkeleton />,
});

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="skeleton h-6 w-48 rounded-lg" />
      <div className="skeleton h-4 w-72 rounded-lg" />
      <div className="skeleton h-40 w-full rounded-xl" />
      <div className="skeleton h-40 w-full rounded-xl" />
    </div>
  );
}

type Tab = "generate" | "posts" | "calendar" | "engage" | "research" | "analytics";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { id: "generate", label: "Generate", icon: PenTool, description: "AI post writer" },
  { id: "posts", label: "My Posts", icon: FileText, description: "Manage content" },
  { id: "calendar", label: "Calendar", icon: Calendar, description: "Schedule view" },
  { id: "engage", label: "Engage", icon: MessageSquare, description: "Auto-comment" },
  { id: "research", label: "Research", icon: Sparkles, description: "Analyze creators" },
  { id: "analytics", label: "Analytics", icon: BarChart3, description: "Track metrics" },
];

// Memoized sidebar nav button — prevents all 6 from re-rendering on tab switch
const NavButton = memo(function NavButton({
  tab,
  active,
  collapsed,
  onClick,
}: {
  tab: typeof TABS[number];
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      title={collapsed ? tab.label : undefined}
      className={`group flex items-center gap-3 w-full rounded-xl transition-all duration-200 ${
        collapsed ? "px-3 py-2.5 justify-center" : "px-3.5 py-2.5"
      } ${
        active
          ? "bg-[#1a1a1a] text-white shadow-sm"
          : "text-gray-500 hover:bg-gray-100 hover:text-[#1a1a1a]"
      }`}
    >
      <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-white" : "text-gray-400 group-hover:text-[#1a1a1a]"}`} />
      {!collapsed && (
        <div className="flex flex-col items-start min-w-0">
          <span className="text-[13px] font-medium leading-tight truncate">{tab.label}</span>
          <span className={`text-[10px] leading-tight truncate ${active ? "text-gray-300" : "text-gray-400"}`}>
            {tab.description}
          </span>
        </div>
      )}
    </button>
  );
});

export default function Dashboard() {
  return (
    <TaskNotificationProvider>
      <DashboardInner />
    </TaskNotificationProvider>
  );
}

function DashboardInner() {
  const [tab, setTab] = useState<Tab>("generate");
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { setNavigateTo } = useTaskNotifications();

  // Register tab navigation so notification toasts can switch tabs
  const navigateToTab = useCallback((t: string) => {
    setTab(t as Tab);
  }, []);

  useEffect(() => {
    setNavigateTo(navigateToTab);
  }, [setNavigateTo, navigateToTab]);

  useEffect(() => {
    checkOnboardingStatus();

    // Listen for message from the Unipile auth popup callback
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "linkedin-connected") {
        setLinkedinConnected(true);
        setConnecting(false);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Close mobile menu on tab change
  const handleTabChange = useCallback((t: Tab) => {
    setTab(t);
    setMobileMenuOpen(false);
  }, []);

  async function checkOnboardingStatus() {
    try {
      const data = await apiGet<{
        voice_profile: unknown;
        linkedin_username: string | null;
      }>("/api/persona");
      setNeedsOnboarding(!data.voice_profile);
    } catch {
      setNeedsOnboarding(true);
    }

    try {
      const status = await apiGet<{ connected: boolean }>(
        "/api/linkedin/status"
      );
      setLinkedinConnected(status.connected);
    } catch {
      setLinkedinConnected(false);
    }
  }

  async function connectLinkedin() {
    setConnecting(true);
    try {
      const data = await apiPost<{ auth_url: string }>("/api/linkedin/connect");
      if (data.auth_url) {
        // Open Unipile hosted auth in a popup
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

  // Memoize the active tab label for header
  const activeTab = useMemo(() => TABS.find((t) => t.id === tab), [tab]);

  if (needsOnboarding === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-[#1a1a1a] flex items-center justify-center animate-pulse-glow">
            <Sword className="h-5 w-5 text-white" />
          </div>
          <div className="skeleton h-2 w-24 rounded-full" />
        </div>
      </div>
    );
  }

  if (needsOnboarding) {
    return <Onboarding onComplete={() => setNeedsOnboarding(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex">
      {/* Sidebar — desktop */}
      <aside
        className={`hidden md:flex flex-col shrink-0 bg-white border-r border-gray-200/80 transition-all duration-300 ${
          sidebarCollapsed ? "w-[72px]" : "w-[220px]"
        }`}
      >
        {/* Logo */}
        <div className={`flex items-center gap-2.5 px-4 py-5 border-b border-gray-100 ${sidebarCollapsed ? "justify-center" : ""}`}>
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-xl bg-[#1a1a1a] flex items-center justify-center shrink-0">
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
                <path d="M13 19l6-6" />
                <path d="M16 16l4 4" />
                <path d="M19 21l2-2" />
              </svg>
            </div>
            {!sidebarCollapsed && (
              <span className="text-[15px] font-semibold tracking-tight text-[#1a1a1a]">
                LinkedInWarrior
              </span>
            )}
          </Link>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2.5 py-4 space-y-1">
          {TABS.map((t) => (
            <NavButton
              key={t.id}
              tab={t}
              active={tab === t.id}
              collapsed={sidebarCollapsed}
              onClick={() => handleTabChange(t.id)}
            />
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className={`px-3 py-4 border-t border-gray-100 space-y-2 ${sidebarCollapsed ? "items-center flex flex-col" : ""}`}>
          {linkedinConnected ? (
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg bg-green-50 text-green-700 ${sidebarCollapsed ? "justify-center" : ""}`}>
              <Linkedin className="h-3.5 w-3.5 shrink-0" />
              {!sidebarCollapsed && <span className="font-medium">Connected</span>}
            </div>
          ) : (
            <button
              onClick={connectLinkedin}
              disabled={connecting}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors disabled:opacity-50 w-full ${sidebarCollapsed ? "justify-center" : ""}`}
            >
              {connecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
              ) : (
                <Linkedin className="h-3.5 w-3.5 shrink-0" />
              )}
              {!sidebarCollapsed && (connecting ? "Connecting…" : "Connect LinkedIn")}
            </button>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors w-full ${sidebarCollapsed ? "justify-center" : ""}`}
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!sidebarCollapsed && <span>Sign out</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex items-center justify-center w-full py-1 text-gray-300 hover:text-gray-500 transition-colors"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              className={`h-4 w-4 transition-transform duration-300 ${sidebarCollapsed ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-gray-200 transform transition-transform duration-300 md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1a1a1a] flex items-center justify-center">
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
                <path d="M13 19l6-6" />
                <path d="M16 16l4 4" />
                <path d="M19 21l2-2" />
              </svg>
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-[#1a1a1a]">LinkedInWarrior</span>
          </Link>
          <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="px-2.5 py-4 space-y-1">
          {TABS.map((t) => (
            <NavButton
              key={t.id}
              tab={t}
              active={tab === t.id}
              collapsed={false}
              onClick={() => handleTabChange(t.id)}
            />
          ))}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-4 sm:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-[#1a1a1a] leading-tight">
                {activeTab?.label}
              </h1>
              <p className="text-xs text-gray-400 hidden sm:block">{activeTab?.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* LinkedIn status — mobile only */}
            <div className="md:hidden">
              {linkedinConnected ? (
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" title="LinkedIn connected" />
              ) : (
                <button
                  onClick={connectLinkedin}
                  disabled={connecting}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-[#1a1a1a] hover:bg-gray-100 transition-colors"
                >
                  <Linkedin className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Tab content */}
        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8 max-w-5xl w-full mx-auto animate-fade-in">
          {tab === "generate" && <PostGenerator />}
          {tab === "posts" && <ContentList />}
          {tab === "calendar" && <CalendarView />}
          {tab === "engage" && <Engagement />}
          {tab === "research" && <CreatorAnalysis />}
          {tab === "analytics" && <AnalyticsDashboard />}
        </main>
      </div>
    </div>
  );
}

