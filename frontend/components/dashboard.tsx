"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { apiGet, apiPost } from "@/lib/api";
import Onboarding from "./onboarding";
import PostGenerator from "./post-generator";
import ContentList from "./content-list";
import CalendarView from "./calendar-view";
import Engagement from "./engagement";
import {
  Sword,
  PenTool,
  FileText,
  Calendar,
  LogOut,
  Linkedin,
  MessageSquare,
  Zap,
  Loader2,
} from "lucide-react";

type Tab = "generate" | "posts" | "calendar" | "engage";

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
          <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center animate-pulse-glow">
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
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass sticky top-0 z-50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center">
            <Sword className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-lg tracking-tight gradient-text">
            LinkedInWarrior
          </span>
        </div>
        <div className="flex items-center gap-4">
          {linkedinConnected ? (
            <div className="flex items-center gap-1.5 text-sm">
              <Linkedin className="h-4 w-4 text-[var(--success)]" />
              <span className="text-[var(--success)]">Connected</span>
            </div>
          ) : (
            <button
              onClick={connectLinkedin}
              disabled={connecting}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
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
            className="btn-ghost p-2 rounded-lg"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="border-b border-[var(--border)] px-6">
        <div className="max-w-4xl mx-auto flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                tab === t.id
                  ? "border-[var(--primary)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--border-hover)]"
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
      </main>
    </div>
  );
}
