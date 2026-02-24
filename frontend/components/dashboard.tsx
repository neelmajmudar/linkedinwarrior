"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";
import Onboarding from "./onboarding";
import PostGenerator from "./post-generator";
import ContentList from "./content-list";
import CalendarView from "./calendar-view";
import Engagement from "./engagement";
import AnalyticsDashboard from "./analytics-dashboard";
import CreatorAnalysis from "./creator-analysis";
import {
  Sword,
  PenTool,
  FileText,
  Calendar,
  LogOut,
  Linkedin,
  MessageSquare,
  BarChart3,
  Zap,
  Loader2,
  Sparkles,
} from "lucide-react";

type Tab = "generate" | "posts" | "calendar" | "engage" | "research" | "analytics";

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>("generate");
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

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

  if (needsOnboarding === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-10 h-10 rounded-full bg-warm-500 flex items-center justify-center animate-pulse-glow">
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

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "generate",
      label: "Generate",
      icon: <PenTool className="h-4 w-4" />,
    },
    {
      id: "posts",
      label: "My Posts",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      id: "engage",
      label: "Engage",
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      id: "research",
      label: "Research",
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: <BarChart3 className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-warm-500 flex items-center justify-center">
            <Sword className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg tracking-tight text-[#1a1a1a]">
            LinkedInWarrior
          </span>
        </div>
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

      {/* Tab navigation */}
      <nav className="border-b border-gray-200 px-6 bg-white">
        <div className="max-w-4xl mx-auto flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                tab === t.id
                  ? "border-[#1a1a1a] text-[#1a1a1a]"
                  : "border-transparent text-gray-400 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8 animate-fade-in">
        {tab === "generate" && <PostGenerator />}
        {tab === "posts" && <ContentList />}
        {tab === "calendar" && <CalendarView />}
        {tab === "engage" && <Engagement />}
        {tab === "research" && <CreatorAnalysis />}
        {tab === "analytics" && <AnalyticsDashboard />}
      </main>
    </div>
  );
}
