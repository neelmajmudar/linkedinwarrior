"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost } from "@/lib/api";
import {
  Search,
  Loader2,
  Check,
  X,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  History,
  Pencil,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";

interface CommentPreview {
  comment_id: string;
  post_social_id: string;
  post_author: string;
  post_content: string;
  comment_text: string;
  status: string;
  share_url?: string;
  post_author_url?: string;
}

interface HistoryItem {
  id: string;
  post_social_id: string;
  post_author: string;
  post_content: string;
  comment_text: string;
  status: string;
  created_at: string;
  share_url?: string;
  post_author_url?: string;
}

export default function Engagement() {
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [previews, setPreviews] = useState<CommentPreview[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [remaining, setRemaining] = useState(15);
  const [dailyLimit, setDailyLimit] = useState(15);
  const [posting, setPosting] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    loadTopics();
    loadRemaining();
  }, []);

  async function loadTopics() {
    setLoading(true);
    try {
      const data = await apiGet<{ topics: string[] }>("/api/engagement/topics");
      setTopics(data.topics || []);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function loadRemaining() {
    try {
      const data = await apiGet<{ remaining_today: number; daily_limit: number }>(
        "/api/engagement/remaining"
      );
      setRemaining(data.remaining_today);
      setDailyLimit(data.daily_limit);
    } catch {
      // ignore
    }
  }

  async function loadHistory() {
    try {
      const data = await apiGet<{
        comments: HistoryItem[];
        remaining_today: number;
        daily_limit: number;
      }>("/api/engagement/history");
      setHistory(data.comments || []);
      setRemaining(data.remaining_today);
      setDailyLimit(data.daily_limit);
    } catch {
      // ignore
    }
  }

  async function addTopic() {
    const trimmed = newTopic.trim();
    if (!trimmed || topics.includes(trimmed)) return;
    const updated = [...topics, trimmed];
    setTopics(updated);
    setNewTopic("");
    try {
      await apiPost("/api/engagement/topics", { topics: updated });
    } catch {
      setTopics(topics);
    }
  }

  async function removeTopic(topic: string) {
    const updated = topics.filter((t) => t !== topic);
    setTopics(updated);
    try {
      await apiPost("/api/engagement/topics", { topics: updated });
    } catch {
      setTopics(topics);
    }
  }

  async function searchPosts() {
    if (topics.length === 0) {
      setError("Add at least one topic first.");
      return;
    }
    setSearching(true);
    setError("");
    setPreviews([]);
    try {
      const data = await apiPost<{
        posts: CommentPreview[];
        remaining_today: number;
      }>("/api/engagement/search", { limit: 5 });
      setPreviews(data.posts || []);
      setRemaining(data.remaining_today);
      if (data.posts.length === 0) {
        setMessage("No matching posts found. Try different topics.");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed");
    }
    setSearching(false);
  }

  async function approveComment(commentId: string, editedText?: string) {
    setPosting((p) => ({ ...p, [commentId]: true }));
    setError("");
    try {
      await apiPost("/api/engagement/approve", {
        comment_id: commentId,
        edited_text: editedText || undefined,
      });
      setPreviews((prev) =>
        prev.map((p) =>
          p.comment_id === commentId ? { ...p, status: "posted" } : p
        )
      );
      setRemaining((r) => Math.max(0, r - 1));
      setEditingId(null);
      setMessage("Comment posted!");
      setTimeout(() => setMessage(""), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to post");
    }
    setPosting((p) => ({ ...p, [commentId]: false }));
  }

  async function skipComment(commentId: string) {
    try {
      await apiPost(`/api/engagement/skip/${commentId}`);
      setPreviews((prev) =>
        prev.map((p) =>
          p.comment_id === commentId ? { ...p, status: "skipped" } : p
        )
      );
    } catch {
      // ignore
    }
  }

  const STATUS_BADGE: Record<string, string> = {
    pending: "bg-amber-50 text-amber-600 border-amber-200",
    posted: "bg-green-50 text-green-700 border-green-200",
    failed: "bg-red-50 text-red-600 border-red-200",
    skipped: "bg-gray-100 text-gray-500 border-gray-200",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl tracking-tight text-[#1a1a1a] mb-1">
            Auto <span className="gradient-text">Engage</span>
          </h2>
          <p className="text-sm text-gray-500">
            Find relevant posts and generate personalized comments in your voice.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
            {remaining}/{dailyLimit} comments left today
          </span>
          <button
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) loadHistory();
            }}
            className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5 border border-gray-200 rounded-full"
          >
            <History className="h-3.5 w-3.5" />
            {showHistory ? "Back" : "History"}
          </button>
        </div>
      </div>

      {/* History view */}
      {showHistory ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500">
            Comment History
          </h3>
          {history.length === 0 ? (
            <p className="text-sm text-gray-400">
              No comments yet.
            </p>
          ) : (
            history.map((item) => {
              const isExpanded = expandedPosts.has(`h-${item.id}`);
              const isLong = item.post_content.length > 150;
              return (
                <div key={item.id} className="glass-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    {item.post_author_url ? (
                      <a
                        href={item.post_author_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-warm-500 hover:text-warm-600 flex items-center gap-1 transition-colors"
                      >
                        {item.post_author || "Unknown author"}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    ) : (
                      <span className="text-xs font-medium text-gray-500">
                        {item.post_author || "Unknown author"}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${
                          STATUS_BADGE[item.status] || ""
                        }`}
                      >
                        {item.status}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className={`text-xs text-gray-400 whitespace-pre-wrap ${!isExpanded && isLong ? "line-clamp-2" : ""}`}>
                      {item.post_content}
                    </p>
                    {isLong && (
                      <button
                        onClick={() => toggleExpand(`h-${item.id}`)}
                        className="text-[10px] text-warm-500 hover:text-warm-600 mt-1 flex items-center gap-0.5"
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {isExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-[#1a1a1a]">{item.comment_text}</p>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <>
          {/* Topics configuration */}
          <div className="glass-card p-4 space-y-3">
            <h3 className="text-sm font-medium text-[#1a1a1a]">Engagement Topics</h3>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warm-50 text-warm-600 text-sm border border-warm-200"
                >
                  {topic}
                  <button
                    onClick={() => removeTopic(topic)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {topics.length === 0 && !loading && (
                <span className="text-sm text-gray-400">
                  No topics yet. Add keywords to find relevant posts.
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTopic()}
                placeholder="e.g. AI startups, product management..."
                className="input-field flex-1"
              />
              <button
                onClick={addTopic}
                disabled={!newTopic.trim()}
                className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          </div>

          {/* Search button */}
          <button
            onClick={searchPosts}
            disabled={searching || topics.length === 0 || remaining <= 0}
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
          >
            {searching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {searching ? "Searching & generating comments..." : "Find Posts & Generate Comments"}
          </button>

          {/* Previews */}
          {previews.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500">
                Review Comments ({previews.filter((p) => p.status === "pending").length} pending)
              </h3>
              {previews.map((preview) => {
                const isExpanded = expandedPosts.has(preview.comment_id);
                const isLong = preview.post_content.length > 150;
                return (
                <div
                  key={preview.comment_id}
                  className="glass-card p-4 space-y-3"
                >
                  {/* Post info */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      {preview.post_author_url ? (
                        <a
                          href={preview.post_author_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-warm-500 hover:text-warm-600 flex items-center gap-1 transition-colors"
                        >
                          {preview.post_author || "Unknown author"}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : (
                        <span className="text-xs font-medium text-warm-500">
                          {preview.post_author || "Unknown author"}
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        {preview.share_url && (
                          <a
                            href={preview.share_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-gray-400 hover:text-warm-500 transition-colors"
                          >
                            View post ↗
                          </a>
                        )}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${
                            STATUS_BADGE[preview.status] || ""
                          }`}
                        >
                          {preview.status}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className={`text-xs text-gray-400 whitespace-pre-wrap ${!isExpanded && isLong ? "line-clamp-3" : ""}`}>
                        {preview.post_content}
                      </p>
                      {isLong && (
                        <button
                          onClick={() => toggleExpand(preview.comment_id)}
                          className="text-[10px] text-warm-500 hover:text-warm-600 mt-1 flex items-center gap-0.5"
                        >
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {isExpanded ? "Show less" : "Show full post"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Comment */}
                  <div className="pl-3 border-l-2 border-warm-300">
                    {editingId === preview.comment_id ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        className="input-field text-sm w-full"
                      />
                    ) : (
                      <p className="text-sm text-[#1a1a1a]">{preview.comment_text}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {preview.status === "pending" && (
                    <div className="flex items-center gap-2">
                      {editingId === preview.comment_id ? (
                        <>
                          <button
                            onClick={() => approveComment(preview.comment_id, editText)}
                            disabled={posting[preview.comment_id]}
                            className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
                          >
                            {posting[preview.comment_id] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            Post Edited
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="btn-ghost px-3 py-1.5 text-xs border border-gray-200 rounded-full"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => approveComment(preview.comment_id)}
                            disabled={posting[preview.comment_id]}
                            className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5"
                          >
                            {posting[preview.comment_id] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Approve & Post
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(preview.comment_id);
                              setEditText(preview.comment_text);
                            }}
                            className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5 border border-gray-200 rounded-full"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => skipComment(preview.comment_id)}
                            className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1.5 border border-gray-200 rounded-full text-gray-400"
                          >
                            <X className="h-3 w-3" />
                            Skip
                          </button>
                        </>
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

      {/* Messages */}
      {message && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-green-50 border border-green-100 text-sm text-green-700 animate-fade-in">
          <Check className="h-4 w-4 shrink-0" />
          {message}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-50 border border-red-100 text-sm text-red-600 animate-fade-in">
          {error}
        </div>
      )}
    </div>
  );
}
