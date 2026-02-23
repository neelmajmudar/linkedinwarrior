"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { format } from "date-fns";
import {
  Trash2,
  Rocket,
  Clock,
  Edit3,
  CheckCircle2,
  XCircle,
  FileText,
  Loader2,
} from "lucide-react";

interface ContentItem {
  id: string;
  prompt: string | null;
  body: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  linkedin_post_id: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "badge-draft",
  approved: "badge-draft",
  scheduled: "badge-scheduled",
  published: "badge-published",
  failed: "bg-[var(--destructive)]/12 text-[var(--destructive)]",
};

export default function ContentList() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await apiGet<ContentItem[]>("/api/content");
      setItems(data);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    setActionLoading(id);
    try {
      await apiDelete(`/api/content/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // ignore
    }
    setActionLoading(null);
  }

  async function handlePublish(id: string) {
    setActionLoading(id);
    try {
      await apiPost(`/api/content/${id}/publish`);
      await loadItems();
    } catch {
      // ignore
    }
    setActionLoading(null);
  }

  async function handleSaveEdit(id: string) {
    setActionLoading(id);
    try {
      await apiPatch(`/api/content/${id}`, { body: editBody });
      setEditingId(null);
      await loadItems();
    } catch {
      // ignore
    }
    setActionLoading(null);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
        <span className="text-sm text-[var(--muted-foreground)]">Loading posts...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--muted)] mb-4">
          <FileText className="h-7 w-7 text-[var(--muted-foreground)]" />
        </div>
        <p className="text-[var(--muted-foreground)] mb-1">No posts yet</p>
        <p className="text-sm text-[var(--muted-foreground)] opacity-60">
          Go to the Generate tab to create your first post.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold tracking-tight">
        My <span className="gradient-text">Posts</span>
      </h2>

      <div className="space-y-3">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className="glass-card p-5 space-y-3 animate-fade-in"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span
                  className={`badge ${STATUS_COLORS[item.status] || "badge-draft"}`}
                >
                  {item.status}
                </span>
                {item.prompt && (
                  <span className="text-xs text-[var(--muted-foreground)] truncate max-w-[300px]">
                    {item.prompt}
                  </span>
                )}
              </div>
              <span className="text-xs text-[var(--muted-foreground)]">
                {format(new Date(item.created_at), "MMM d, yyyy h:mm a")}
              </span>
            </div>

            {/* Body */}
            {editingId === item.id ? (
              <div className="space-y-3">
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={8}
                  className="input-field resize-y font-mono text-sm leading-relaxed"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(item.id)}
                    disabled={actionLoading === item.id}
                    className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1 border border-[var(--border)] rounded-lg"
                  >
                    <XCircle className="h-3 w-3" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-[var(--card-foreground)]">
                {item.body.length > 500
                  ? item.body.slice(0, 500) + "..."
                  : item.body}
              </p>
            )}

            {/* Scheduled info */}
            {item.scheduled_at && item.status === "scheduled" && (
              <p className="text-xs text-[var(--warning)] flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                Scheduled for{" "}
                {format(new Date(item.scheduled_at), "MMM d, yyyy h:mm a")}
              </p>
            )}

            {/* Published info */}
            {item.published_at && (
              <p className="text-xs text-[var(--success)] flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" />
                Published{" "}
                {format(new Date(item.published_at), "MMM d, yyyy h:mm a")}
              </p>
            )}

            {/* Actions */}
            {item.status !== "published" && editingId !== item.id && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    setEditingId(item.id);
                    setEditBody(item.body);
                  }}
                  className="btn-ghost px-2.5 py-1 text-xs flex items-center gap-1 border border-[var(--border)] rounded-lg"
                >
                  <Edit3 className="h-3 w-3" />
                  Edit
                </button>
                {item.status !== "scheduled" && (
                  <button
                    onClick={() => handlePublish(item.id)}
                    disabled={actionLoading === item.id}
                    className="btn-primary px-2.5 py-1 text-xs flex items-center gap-1"
                  >
                    {actionLoading === item.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Rocket className="h-3 w-3" />
                    )}
                    Publish
                  </button>
                )}
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={actionLoading === item.id}
                  className="btn-ghost px-2.5 py-1 text-xs flex items-center gap-1 border border-[var(--destructive)]/30 rounded-lg text-[var(--destructive)] hover:bg-[var(--destructive)]/10 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
