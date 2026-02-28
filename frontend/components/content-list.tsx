"use client";

import { useState, useEffect, useMemo, useCallback, memo } from "react";
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ExternalLink,
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

interface PaginatedResponse {
  items: ContentItem[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  draft: { bg: "bg-gray-50", text: "text-gray-600", dot: "bg-gray-400" },
  approved: { bg: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-400" },
  scheduled: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-500" },
  publishing: { bg: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-500" },
  published: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
  failed: { bg: "bg-red-50", text: "text-red-600", dot: "bg-red-500" },
};

const PAGE_SIZE = 10;

// Memoized post card — only re-renders when its own item/state changes
const PostCard = memo(function PostCard({
  item,
  index,
  editingId,
  editBody,
  actionLoading,
  onEdit,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onPublish,
  onDelete,
}: {
  item: ContentItem;
  index: number;
  editingId: string | null;
  editBody: string;
  actionLoading: string | null;
  onEdit: (id: string, body: string) => void;
  onEditChange: (body: string) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const style = STATUS_STYLES[item.status] || STATUS_STYLES.draft;
  const isEditing = editingId === item.id;
  const isLoading = actionLoading === item.id;
  const isPublished = item.status === "published";

  return (
    <div
      className="bg-white rounded-xl border border-gray-200/80 p-5 space-y-3 animate-fade-in hover:border-gray-300/80 transition-colors"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${style.bg} ${style.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
            {item.status}
          </span>
          {item.prompt && (
            <span className="text-xs text-gray-400 truncate max-w-[280px]">
              {item.prompt}
            </span>
          )}
        </div>
        <span className="text-[11px] text-gray-400 tabular-nums shrink-0">
          {format(new Date(item.created_at), "MMM d, yyyy")}
        </span>
      </div>

      {/* Body */}
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editBody}
            onChange={(e) => onEditChange(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-gray-200 bg-[#fafafa] px-4 py-3 text-sm text-[#1a1a1a] font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#1a1a1a]/10 focus:border-gray-300 transition-all"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onSaveEdit(item.id)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-full bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Save
            </button>
            <button
              onClick={onCancelEdit}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <XCircle className="h-3 w-3" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm whitespace-pre-wrap leading-relaxed text-[#1a1a1a]">
          {item.body.length > 500 ? item.body.slice(0, 500) + "…" : item.body}
        </p>
      )}

      {/* Scheduled info */}
      {item.scheduled_at && item.status === "scheduled" && (
        <p className="text-xs text-amber-600 flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          Scheduled for {format(new Date(item.scheduled_at), "MMM d, yyyy h:mm a")}
        </p>
      )}

      {/* Published info */}
      {item.published_at && isPublished && (
        <div className="flex items-center gap-3">
          <p className="text-xs text-green-600 flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3" />
            Published {format(new Date(item.published_at), "MMM d, yyyy h:mm a")}
          </p>
          {item.linkedin_post_id && (
            <a
              href={`https://www.linkedin.com/feed/update/${item.linkedin_post_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-[#1a1a1a] flex items-center gap-1 transition-colors"
            >
              View on LinkedIn <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      )}

      {/* Actions */}
      {!isPublished && !isEditing && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => onEdit(item.id, item.body)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-[#1a1a1a] transition-colors"
          >
            <Edit3 className="h-3 w-3" />
            Edit
          </button>
          {item.status !== "scheduled" && (
            <button
              onClick={() => onPublish(item.id)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
              Publish
            </button>
          )}
          <button
            onClick={() => onDelete(item.id)}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
});

export default function ContentList() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [publishedOpen, setPublishedOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    loadItems(page);
  }, [page]);

  async function loadItems(p: number) {
    setLoading(true);
    try {
      const data = await apiGet<PaginatedResponse>(
        `/api/content?page=${p}&page_size=${PAGE_SIZE}`
      );
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setHasNext(data.has_next ?? false);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  // Separate published and active items — memoized to avoid recomputing on every render
  const { activeItems, publishedItems } = useMemo(() => {
    const active: ContentItem[] = [];
    const published: ContentItem[] = [];
    for (const item of items) {
      if (item.status === "published") {
        published.push(item);
      } else {
        active.push(item);
      }
    }
    return { activeItems: active, publishedItems: published };
  }, [items]);

  const handleDelete = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      await apiDelete(`/api/content/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // ignore
    }
    setActionLoading(null);
  }, []);

  const handlePublish = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      await apiPost(`/api/content/${id}/publish`);
      await loadItems(page);
    } catch {
      // ignore
    }
    setActionLoading(null);
  }, [page]);

  const handleSaveEdit = useCallback(async (id: string) => {
    setActionLoading(id);
    try {
      await apiPatch(`/api/content/${id}`, { body: editBody });
      setEditingId(null);
      await loadItems(page);
    } catch {
      // ignore
    }
    setActionLoading(null);
  }, [editBody, page]);

  const handleEdit = useCallback((id: string, body: string) => {
    setEditingId(id);
    setEditBody(body);
  }, []);

  const handleEditChange = useCallback((body: string) => {
    setEditBody(body);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="text-sm text-gray-400">Loading posts…</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 mb-5">
          <FileText className="h-7 w-7 text-gray-400" />
        </div>
        <p className="text-gray-500 mb-1 text-base">No posts yet</p>
        <p className="text-sm text-gray-400">
          Go to the Generate tab to create your first post.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl tracking-tight text-[#1a1a1a]">
          My <span className="gradient-text">Posts</span>
        </h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
          {total} post{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Active posts (draft, scheduled, failed) */}
      {activeItems.length > 0 && (
        <div className="space-y-3">
          {activeItems.map((item, idx) => (
            <PostCard
              key={item.id}
              item={item}
              index={idx}
              editingId={editingId}
              editBody={editBody}
              actionLoading={actionLoading}
              onEdit={handleEdit}
              onEditChange={handleEditChange}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              onPublish={handlePublish}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Published posts — collapsible dropdown */}
      {publishedItems.length > 0 && (
        <div className="rounded-xl border border-gray-200/80 bg-white overflow-hidden">
          <button
            onClick={() => setPublishedOpen(!publishedOpen)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-[#1a1a1a]">Published</span>
              </div>
              <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
                {publishedItems.length}
              </span>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                publishedOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {publishedOpen && (
            <div className="border-t border-gray-100 px-3 py-3 space-y-3">
              {publishedItems.map((item, idx) => (
                <PostCard
                  key={item.id}
                  item={item}
                  index={idx}
                  editingId={editingId}
                  editBody={editBody}
                  actionLoading={actionLoading}
                  onEdit={handleEdit}
                  onEditChange={handleEditChange}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onPublish={handlePublish}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            <ChevronLeft className="h-3 w-3" />
            Previous
          </button>
          <span className="text-xs text-gray-500 tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
