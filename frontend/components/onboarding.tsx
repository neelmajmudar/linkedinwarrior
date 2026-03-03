"use client";

import { useState } from "react";
import {
  Linkedin,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sword,
  ArrowRight,
  Scan,
  Brain,
  Sparkles,
} from "lucide-react";

interface OnboardingProps {
  linkedinConnected: boolean;
  connecting: boolean;
  onConnectLinkedin: () => void;
  onAnalyze: (username: string) => void;
}

export default function Onboarding({
  linkedinConnected,
  connecting,
  onConnectLinkedin,
  onAnalyze,
}: OnboardingProps) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const step = linkedinConnected ? "profile" : "connect";

  function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleaned = username
      .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "")
      .replace(/\/$/, "");

    if (!cleaned) {
      setError("Please enter a valid LinkedIn username or profile URL");
      return;
    }

    onAnalyze(cleaned);
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-white via-warm-50/30 to-warm-100/30">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Logo + Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-warm-500 mb-6 shadow-lg shadow-warm-500/20">
            <Sword className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1a1a1a] mb-3">
            Welcome to <span className="gradient-text">LinkedInWarrior</span>
          </h1>
          <p className="text-gray-500 text-base leading-relaxed max-w-md mx-auto">
            {step === "connect"
              ? "Connect your LinkedIn account to get started. We\u2019ll learn your writing voice and help you create authentic content."
              : "Great! Now tell us which profile to analyze. We\u2019ll study your posts to learn your unique writing style."}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { num: 1, label: "Connect", done: linkedinConnected },
            { num: 2, label: "Analyze", done: false },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    s.done
                      ? "bg-green-100 text-green-700 border-2 border-green-300"
                      : s.num === (step === "connect" ? 1 : 2)
                      ? "bg-warm-500 text-white shadow-md shadow-warm-500/20"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {s.done ? <CheckCircle2 className="h-4 w-4" /> : s.num}
                </div>
                <span
                  className={`text-sm font-medium ${
                    s.done
                      ? "text-green-700"
                      : s.num === (step === "connect" ? 1 : 2)
                      ? "text-[#1a1a1a]"
                      : "text-gray-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i === 0 && <div className="w-12 h-px bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl p-8 shadow-lg shadow-gray-100/50 border border-gray-100">
          {step === "connect" ? (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[#0A66C2]/10 border border-[#0A66C2]/20">
                <Linkedin className="h-10 w-10 text-[#0A66C2]" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[#1a1a1a] mb-2">
                  Connect your LinkedIn
                </h2>
                <p className="text-sm text-gray-500 max-w-sm mx-auto">
                  This lets us publish posts on your behalf and track your
                  engagement metrics.
                </p>
              </div>

              <button
                onClick={onConnectLinkedin}
                disabled={connecting}
                className="w-full py-4 px-6 rounded-xl bg-[#0A66C2] text-white font-medium text-base
                  hover:bg-[#004182] transition-all disabled:opacity-50 disabled:cursor-not-allowed
                  flex items-center justify-center gap-3 shadow-lg shadow-[#0A66C2]/20"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Linkedin className="h-5 w-5" />
                    Connect LinkedIn Account
                  </>
                )}
              </button>

              <p className="text-xs text-gray-400">
                A secure popup will open for LinkedIn authentication
              </p>
            </div>
          ) : (
            <form onSubmit={handleAnalyze} className="space-y-6">
              <div className="text-center mb-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-medium mb-4">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  LinkedIn Connected
                </div>
                <h2 className="text-lg font-semibold text-[#1a1a1a] mb-2">
                  Which profile should we analyze?
                </h2>
                <p className="text-sm text-gray-500">
                  We&apos;ll study up to 200 posts to learn your voice.
                </p>
              </div>

              <div>
                <div className="relative">
                  <Linkedin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#0A66C2]" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="linkedin.com/in/yourname"
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 text-base
                      focus:outline-none focus:ring-2 focus:ring-warm-500/20 focus:border-warm-500
                      placeholder:text-gray-300 transition-all"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2 ml-1">
                  Enter a LinkedIn username or full profile URL
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 text-base font-medium rounded-xl"
              >
                Analyze My Posts
                <ArrowRight className="h-5 w-5" />
              </button>

              <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
                <div className="flex items-center gap-1.5">
                  <Scan className="h-3.5 w-3.5" />
                  Scrape posts
                </div>
                <div className="flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5" />
                  Analyze style
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Build persona
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
