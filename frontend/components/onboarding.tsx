"use client";

import { useState, useEffect } from "react";
import { apiPost, apiGet } from "@/lib/api";
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

type Step = "linkedin-url" | "scraping" | "done";

export default function Onboarding({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [step, setStep] = useState<Step>("linkedin-url");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  async function handleStartScrape(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleaned = username
      .replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "")
      .replace(/\/$/, "");

    if (!cleaned) {
      setError("Please enter a valid LinkedIn username or profile URL");
      return;
    }

    try {
      await apiPost("/api/scrape", {
        linkedin_username: cleaned,
        max_posts: 200,
      });
      setStep("scraping");
      setStatusMessage("Scraping your LinkedIn posts...");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start scrape");
    }
  }

  useEffect(() => {
    if (step !== "scraping") return;

    const interval = setInterval(async () => {
      try {
        const status = await apiGet<{
          scrape_status: string;
          posts_count: number;
          embeddings_count: number;
        }>("/api/scrape/status");

        if (status.scrape_status === "done") {
          setStatusMessage(
            `Done! Analyzed ${status.posts_count} posts and created ${status.embeddings_count} embeddings.`
          );
          setStep("done");
          clearInterval(interval);
        } else if (status.scrape_status === "running") {
          if (status.posts_count > 0 && status.embeddings_count === 0) {
            setStatusMessage(
              `Scraped ${status.posts_count} posts. Building embeddings...`
            );
          } else if (status.embeddings_count > 0) {
            setStatusMessage(
              `${status.posts_count} posts embedded. Building your voice profile...`
            );
          }
        } else if (status.scrape_status === "error") {
          setError(
            "Something went wrong during scraping. Please try again."
          );
          setStep("linkedin-url");
          clearInterval(interval);
        }
      } catch {
        // keep polling
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [step]);

  const pipelineSteps = [
    { icon: <Scan className="h-4 w-4" />, label: "Scrape posts" },
    { icon: <Brain className="h-4 w-4" />, label: "Build embeddings" },
    { icon: <Sparkles className="h-4 w-4" />, label: "Create voice profile" },
  ];

  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-white via-warm-50 to-warm-100">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-warm-500 mb-5">
            <Sword className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl tracking-tight text-[#1a1a1a] mb-3">
            Set up your <span className="gradient-text">voice profile</span>
          </h1>
          <p className="text-gray-500 text-base leading-relaxed max-w-md mx-auto">
            We&apos;ll analyze your LinkedIn posts to learn how you write, then
            generate new content in your authentic voice.
          </p>
        </div>

        {/* Pipeline steps indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {pipelineSteps.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
                  step === "linkedin-url" && i === 0
                    ? "bg-warm-100 text-warm-600 border border-warm-300"
                    : step === "scraping"
                    ? i <= 1
                      ? "bg-warm-100 text-warm-600 border border-warm-300"
                      : "bg-gray-100 text-gray-400 border border-transparent"
                    : step === "done"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-gray-100 text-gray-400 border border-transparent"
                }`}
              >
                {s.icon}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < pipelineSteps.length - 1 && (
                <div className="w-4 h-px bg-gray-200" />
              )}
            </div>
          ))}
        </div>

        {/* Main card */}
        <div className="bg-white rounded-lg p-8 shadow-sm border border-gray-100">
          {step === "linkedin-url" && (
            <form onSubmit={handleStartScrape} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  LinkedIn Profile
                </label>
                <div className="relative">
                  <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-warm-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="linkedin.com/in/yourname or just yourname"
                    className="input-field pl-10"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Enter your LinkedIn username or full profile URL
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 px-3 py-2 rounded-md bg-red-50 border border-red-100">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-sm"
              >
                Analyze My Posts
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {step === "scraping" && (
            <div className="text-center space-y-5 py-4">
              <div className="relative inline-flex">
                <Loader2 className="h-12 w-12 animate-spin text-warm-500" />
              </div>
              <div>
                <p className="text-[#1a1a1a] font-medium mb-1">
                  {statusMessage}
                </p>
                <p className="text-xs text-gray-400">
                  This may take a minute or two...
                </p>
              </div>
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-warm-400"
                    style={{
                      animation: `pulse-glow 1.4s ease-in-out ${i * 0.2}s infinite`,
                      opacity: 0.4 + i * 0.2,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="text-center space-y-5 py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-50 border border-green-200">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-[#1a1a1a] mb-1">
                  Voice profile ready!
                </p>
                <p className="text-sm text-gray-500">
                  {statusMessage}
                </p>
              </div>
              <button
                onClick={onComplete}
                className="btn-primary px-8 py-3 inline-flex items-center gap-2 text-sm"
              >
                Start Creating Content
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
