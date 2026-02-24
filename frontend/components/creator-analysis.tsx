"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost } from "@/lib/api";
import {
  Search,
  Loader2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  FileText,
  Sparkles,
  Building2,
  Users,
} from "lucide-react";

type ResearchMode = "creators" | "competitors";

interface CreatorSummary {
  name: string;
  public_identifier: string;
  headline: string;
  post_count: number;
}

interface CreatorDetail {
  creator_name: string;
  headline?: string;
  writing_style?: string;
  common_topics?: string[];
  post_structure_patterns?: string[];
  hook_examples?: string[];
  engagement_tactics?: string[];
  vocabulary_signature?: string[];
  content_formats?: string[];
  strengths?: string[];
  weaknesses?: string[];
  key_takeaways?: string[];
  error?: string;
}

interface Report {
  niche?: string;
  executive_summary?: string;
  cross_creator_patterns?: string[];
  top_hooks_and_formats?: string[];
  content_strategy_recommendations?: string[];
  topics_that_perform?: string[];
  formatting_best_practices?: string[];
  style_comparison_matrix?: { creator: string; style_in_one_line: string; best_for: string }[];
  avoid_these_mistakes?: string[];
  action_plan?: string;
  creators?: CreatorDetail[];
  error?: string;
}

interface ReportListItem {
  id: string;
  niche: string;
  creators_analyzed: CreatorSummary[];
  status: string;
  error_message: string | null;
  created_at: string;
}

interface FullReport {
  id: string;
  niche: string;
  creators_analyzed: CreatorSummary[];
  report: Report;
  status: string;
  error_message: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-green-50 text-green-700 border-green-200",
  failed: "bg-red-50 text-red-600 border-red-200",
  running: "bg-amber-50 text-amber-600 border-amber-200",
  pending: "bg-gray-100 text-gray-500 border-gray-200",
};

export default function CreatorAnalysis() {
  const [mode, setMode] = useState<ResearchMode>("creators");
  // Creator inputs
  const [niche, setNiche] = useState("");
  const [creatorUrls, setCreatorUrls] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState("");
  // Competitor inputs
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [compInput, setCompInput] = useState("");
  // Shared state
  const [running, setRunning] = useState(false);
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<FullReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [expandedCreators, setExpandedCreators] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [pollingId, setPollingId] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(async () => {
      try {
        const report = await apiGet<FullReport>(`/api/creator-analysis/reports/${pollingId}`);
        if (report.status === "completed" || report.status === "failed") {
          setPollingId(null);
          setRunning(false);
          setSelectedReport(report);
          loadReports();
        }
      } catch {
        // ignore
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [pollingId]);

  async function loadReports() {
    try {
      const data = await apiGet<{ reports: ReportListItem[] }>("/api/creator-analysis/reports");
      setReports(data.reports || []);
    } catch {
      // ignore
    }
  }

  async function startCreatorAnalysis() {
    if (!niche.trim()) { setError("Enter a niche or keywords."); return; }
    setRunning(true);
    setError("");
    setSelectedReport(null);
    try {
      const data = await apiPost<{ report_id: string }>("/api/creator-analysis/run", {
        niche: niche.trim(),
        creator_urls: creatorUrls.length > 0 ? creatorUrls : undefined,
      });
      setPollingId(data.report_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start analysis");
      setRunning(false);
    }
  }

  async function startCompetitorAnalysis() {
    if (competitors.length === 0) { setError("Add at least one competitor."); return; }
    setRunning(true);
    setError("");
    setSelectedReport(null);
    try {
      const data = await apiPost<{ report_id: string }>("/api/creator-analysis/competitor", {
        competitors,
      });
      setPollingId(data.report_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start analysis");
      setRunning(false);
    }
  }

  async function viewReport(reportId: string) {
    setLoadingReport(true);
    setSelectedReport(null);
    try {
      const report = await apiGet<FullReport>(`/api/creator-analysis/reports/${reportId}`);
      setSelectedReport(report);
    } catch {
      setError("Failed to load report");
    }
    setLoadingReport(false);
  }

  function addUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed || creatorUrls.includes(trimmed)) return;
    setCreatorUrls([...creatorUrls, trimmed]);
    setUrlInput("");
  }

  function addCompetitor() {
    const trimmed = compInput.trim();
    if (!trimmed || competitors.includes(trimmed)) return;
    setCompetitors([...competitors, trimmed]);
    setCompInput("");
  }

  function toggleCreator(name: string) {
    setExpandedCreators((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const report = selectedReport?.report;
  const isCompetitorReport = selectedReport?.niche?.startsWith("Competitor:");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl tracking-tight text-[#1a1a1a] mb-1">
          LinkedIn <span className="gradient-text">Research</span>
        </h2>
        <p className="text-sm text-gray-500">
          Analyze top creators or competitors — discover strategies, writing styles, and content patterns.
        </p>
      </div>

      {/* Mode toggle */}
      {!selectedReport && !running && (
        <div className="flex gap-2">
          <button
            onClick={() => { setMode("creators"); setError(""); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-full border transition-colors ${
              mode === "creators"
                ? "bg-warm-500 text-white border-warm-500"
                : "bg-white text-gray-600 border-gray-200 hover:border-warm-300"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            Creator Research
          </button>
          <button
            onClick={() => { setMode("competitors"); setError(""); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm rounded-full border transition-colors ${
              mode === "competitors"
                ? "bg-warm-500 text-white border-warm-500"
                : "bg-white text-gray-600 border-gray-200 hover:border-warm-300"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Competitor Research
          </button>
        </div>
      )}

      {/* Creator input form */}
      {!selectedReport && !running && mode === "creators" && (
        <div className="glass-card p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Niche / Keywords
            </label>
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startCreatorAnalysis()}
              placeholder="e.g. AI founders, SaaS marketing, personal branding..."
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Specific Creator URLs <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addUrl()}
                placeholder="linkedin.com/in/username"
                className="input-field flex-1"
              />
              <button
                onClick={addUrl}
                disabled={!urlInput.trim()}
                className="btn-ghost px-3 py-2 text-sm flex items-center gap-1 border border-gray-200 rounded-full disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            {creatorUrls.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {creatorUrls.map((url) => (
                  <span
                    key={url}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warm-50 text-warm-600 text-xs border border-warm-200"
                  >
                    {url.split("/").pop()}
                    <button onClick={() => setCreatorUrls(creatorUrls.filter((u) => u !== url))} className="hover:text-red-500 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={startCreatorAnalysis}
            disabled={!niche.trim()}
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Analyze Top Creators
          </button>
        </div>
      )}

      {/* Competitor input form */}
      {!selectedReport && !running && mode === "competitors" && (
        <div className="glass-card p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              Competitor Organizations
            </label>
            <p className="text-xs text-gray-400 mb-2">
              Add company names to analyze their LinkedIn content strategy, posting patterns, and engagement.
            </p>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={compInput}
                onChange={(e) => setCompInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCompetitor()}
                placeholder="e.g. HubSpot, Gong, Drift..."
                className="input-field flex-1"
              />
              <button
                onClick={addCompetitor}
                disabled={!compInput.trim()}
                className="btn-ghost px-3 py-2 text-sm flex items-center gap-1 border border-gray-200 rounded-full disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
            {competitors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {competitors.map((comp) => (
                  <span
                    key={comp}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs border border-blue-200"
                  >
                    <Building2 className="h-3 w-3" />
                    {comp}
                    <button onClick={() => setCompetitors(competitors.filter((c) => c !== comp))} className="hover:text-red-500 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={startCompetitorAnalysis}
            disabled={competitors.length === 0}
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
          >
            <Building2 className="h-4 w-4" />
            Analyze Competitors
          </button>
        </div>
      )}

      {/* Running state */}
      {running && (
        <div className="glass-card p-8 text-center space-y-3 animate-fade-in">
          <Loader2 className="h-10 w-10 animate-spin text-warm-500 mx-auto" />
          <p className="text-sm text-[#1a1a1a] font-medium">
            {mode === "competitors" ? "Analyzing competitor strategies..." : "Discovering and analyzing creators..."}
          </p>
          <p className="text-xs text-gray-400">Searching LinkedIn posts, running AI analysis. This may take 1-2 minutes.</p>
          <div className="flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-warm-400"
                style={{ animation: `pulse-glow 1.4s ease-in-out ${i * 0.2}s infinite`, opacity: 0.4 + i * 0.2 }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Report display */}
      {selectedReport && (
        <div className="space-y-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {selectedReport.status === "completed" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium text-[#1a1a1a]">
                {selectedReport.niche}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(selectedReport.created_at).toLocaleDateString()}
              </span>
            </div>
            <button
              onClick={() => setSelectedReport(null)}
              className="btn-ghost px-3 py-1.5 text-xs border border-gray-200 rounded-full"
            >
              Back
            </button>
          </div>

          {selectedReport.status === "failed" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-100 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {selectedReport.error_message || "Analysis failed"}
            </div>
          )}

          {report && !report.error && (
            <>
              {report.executive_summary && (
                <div className="glass-card p-5 space-y-2">
                  <h3 className="text-sm font-medium text-[#1a1a1a]">Executive Summary</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {report.executive_summary}
                  </p>
                </div>
              )}

              {(selectedReport.creators_analyzed || []).length > 0 && (
                <div className="glass-card p-5 space-y-3">
                  <h3 className="text-sm font-medium text-[#1a1a1a]">
                    {isCompetitorReport ? "Competitors" : "Creators"} Analyzed ({selectedReport.creators_analyzed.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedReport.creators_analyzed.map((c) => (
                      <a
                        key={c.public_identifier}
                        href={isCompetitorReport ? `https://www.linkedin.com/company/${c.public_identifier}` : `https://www.linkedin.com/in/${c.public_identifier}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border hover:opacity-80 transition-colors ${
                          isCompetitorReport ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-warm-50 text-warm-600 border-warm-200"
                        }`}
                      >
                        {isCompetitorReport && <Building2 className="h-2.5 w-2.5" />}
                        {c.name || c.public_identifier}
                        <span className="text-[10px] opacity-60">{c.post_count} posts</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {report.cross_creator_patterns && report.cross_creator_patterns.length > 0 && (
                <div className="glass-card p-5 space-y-2">
                  <h3 className="text-sm font-medium text-[#1a1a1a]">
                    {isCompetitorReport ? "Cross-Competitor" : "Cross-Creator"} Patterns
                  </h3>
                  <ul className="space-y-1.5">
                    {report.cross_creator_patterns.map((p, i) => (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className="text-warm-400 shrink-0">-</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.content_strategy_recommendations && report.content_strategy_recommendations.length > 0 && (
                <div className="glass-card p-5 space-y-2">
                  <h3 className="text-sm font-medium text-[#1a1a1a]">Content Strategy Recommendations</h3>
                  <ul className="space-y-1.5">
                    {report.content_strategy_recommendations.map((r, i) => (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className="text-green-500 shrink-0">{i + 1}.</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.top_hooks_and_formats && report.top_hooks_and_formats.length > 0 && (
                <div className="glass-card p-5 space-y-2">
                  <h3 className="text-sm font-medium text-[#1a1a1a]">Top Hooks & Formats</h3>
                  <ul className="space-y-1.5">
                    {report.top_hooks_and_formats.map((h, i) => (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className="text-warm-500 shrink-0">-</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.topics_that_perform && report.topics_that_perform.length > 0 && (
                <div className="glass-card p-5 space-y-2">
                  <h3 className="text-sm font-medium text-[#1a1a1a]">Topics That Perform</h3>
                  <div className="flex flex-wrap gap-2">
                    {report.topics_that_perform.map((t, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs border border-green-200">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {report.style_comparison_matrix && report.style_comparison_matrix.length > 0 && (
                <div className="glass-card p-5 space-y-3">
                  <h3 className="text-sm font-medium text-[#1a1a1a]">Style Comparison</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">{isCompetitorReport ? "Competitor" : "Creator"}</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Style</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Best For</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.style_comparison_matrix.map((row, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="py-2 px-2 font-medium text-[#1a1a1a]">{row.creator}</td>
                            <td className="py-2 px-2 text-gray-600">{row.style_in_one_line}</td>
                            <td className="py-2 px-2 text-gray-600">{row.best_for}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {report.action_plan && (
                <div className="glass-card p-5 space-y-2 border-l-4 border-warm-400">
                  <h3 className="text-sm font-medium text-[#1a1a1a]">Action Plan</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {report.action_plan}
                  </p>
                </div>
              )}

              {report.avoid_these_mistakes && report.avoid_these_mistakes.length > 0 && (
                <div className="glass-card p-5 space-y-2">
                  <h3 className="text-sm font-medium text-[#1a1a1a]">Avoid These Mistakes</h3>
                  <ul className="space-y-1.5">
                    {report.avoid_these_mistakes.map((m, i) => (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className="text-red-400 shrink-0">-</span>
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {report.creators && report.creators.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-[#1a1a1a]">
                    Individual {isCompetitorReport ? "Competitor" : "Creator"} Breakdowns
                  </h3>
                  {report.creators.map((creator) => {
                    const isOpen = expandedCreators.has(creator.creator_name);
                    return (
                      <div key={creator.creator_name} className="glass-card overflow-hidden">
                        <button
                          onClick={() => toggleCreator(creator.creator_name)}
                          className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                        >
                          <div>
                            <span className="text-sm font-medium text-[#1a1a1a]">{creator.creator_name}</span>
                            {creator.headline && (
                              <p className="text-xs text-gray-400 mt-0.5">{creator.headline}</p>
                            )}
                          </div>
                          {isOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                        </button>
                        {isOpen && !creator.error && (
                          <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                            {creator.writing_style && (
                              <div>
                                <span className="text-xs font-medium text-gray-500">Writing Style</span>
                                <p className="text-sm text-gray-600 mt-0.5">{creator.writing_style}</p>
                              </div>
                            )}
                            {creator.common_topics && creator.common_topics.length > 0 && (
                              <div>
                                <span className="text-xs font-medium text-gray-500">Common Topics</span>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {creator.common_topics.map((t, i) => (
                                    <span key={i} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">{t}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {creator.hook_examples && creator.hook_examples.length > 0 && (
                              <div>
                                <span className="text-xs font-medium text-gray-500">Best Hooks</span>
                                <ul className="mt-1 space-y-1">
                                  {creator.hook_examples.map((h, i) => (
                                    <li key={i} className="text-xs text-gray-500 italic">&ldquo;{h}&rdquo;</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {creator.strengths && creator.strengths.length > 0 && (
                              <div>
                                <span className="text-xs font-medium text-gray-500">Strengths</span>
                                <ul className="mt-1 space-y-0.5">
                                  {creator.strengths.map((s, i) => (
                                    <li key={i} className="text-xs text-green-600 flex gap-1">
                                      <span>+</span> {s}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {creator.key_takeaways && creator.key_takeaways.length > 0 && (
                              <div>
                                <span className="text-xs font-medium text-gray-500">Key Takeaways</span>
                                <ul className="mt-1 space-y-0.5">
                                  {creator.key_takeaways.map((t, i) => (
                                    <li key={i} className="text-xs text-gray-600 flex gap-1">
                                      <span className="text-warm-500">{i + 1}.</span> {t}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Past Reports */}
      {!selectedReport && !running && reports.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500">Past Reports</h3>
          {reports.map((r) => {
            const isComp = r.niche?.startsWith("Competitor:");
            return (
              <button
                key={r.id}
                onClick={() => viewReport(r.id)}
                disabled={loadingReport}
                className="glass-card p-4 w-full text-left hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isComp ? <Building2 className="h-4 w-4 text-blue-500" /> : <FileText className="h-4 w-4 text-warm-500" />}
                    <span className="text-sm font-medium text-[#1a1a1a]">{r.niche}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${STATUS_BADGE[r.status] || ""}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(r.creators_analyzed || []).length > 0 && (
                      <span className="text-xs text-gray-400">
                        {r.creators_analyzed.length} {isComp ? "orgs" : "creators"}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!selectedReport && !running && reports.length === 0 && (
        <div className="glass-card p-8 text-center space-y-2">
          <Search className="h-8 w-8 mx-auto text-gray-300" />
          <p className="text-sm text-gray-400">
            No reports yet. Choose a research mode above to get started.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-100 text-sm text-red-600 animate-fade-in">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
