"use client";

import { useState, useEffect, useRef } from "react";
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
  ImagePlus,
  X,
} from "lucide-react";

interface ContentItem {
  id: string;
  prompt: string | null;
  body: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  linkedin_post_id: string | null;
  image_url: string | null;
  created_at: string;
}

interface PaginatedResponse {
  items: ContentItem[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "badge-draft",
  approved: "badge-draft",
  scheduled: "badge-scheduled",
  published: "badge-published",
  failed: "bg-red-50 text-red-600",
};

const PAGE_SIZE = 10;

export default function ContentList() {
  // Active (non-published) posts
  const [activeItems, setActiveItems] = useState<ContentItem[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [activeTotal, setActiveTotal] = useState(0);
  const [activeHasNext, setActiveHasNext] = useState(false);

  // Published posts
  const [publishedItems, setPublishedItems] = useState<ContentItem[]>([]);
  const [pubPage, setPubPage] = useState(1);
  const [pubTotal, setPubTotal] = useState(0);
  const [pubHasNext, setPubHasNext] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const activeTotalPages = Math.max(1, Math.ceil(activeTotal / PAGE_SIZE));
  const pubTotalPages = Math.max(1, Math.ceil(pubTotal / PAGE_SIZE));

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadActiveItems(activePage),
      // Fetch just the published count for the toggle button badge
      apiGet<PaginatedResponse>(`/api/content?status=published&page=1&page_size=1`)
        .then((data) => setPubTotal(data.total ?? 0))
        .catch(() => {}),
    ]).then(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadActiveItems(activePage);
  }, [activePage]);

  useEffect(() => {
    if (showHistory) loadPublishedItems(pubPage);
  }, [pubPage, showHistory]);

  async function loadActiveItems(p: number) {
    try {
      const data = await apiGet<PaginatedResponse>(
        `/api/content?exclude_status=published&page=${p}&page_size=${PAGE_SIZE}`
      );
      // Belt-and-suspenders: filter out published on the client side too
      const nonPublished = (data.items ?? []).filter((i) => i.status !== "published");
      setActiveItems(nonPublished);
      setActiveTotal(data.total ?? 0);
      setActiveHasNext(data.has_next ?? false);
    } catch {
      // ignore
    }
  }

  async function loadPublishedItems(p: number) {
    try {
      const data = await apiGet<PaginatedResponse>(
        `/api/content?status=published&page=${p}&page_size=${PAGE_SIZE}`
      );
      setPublishedItems(data.items ?? []);
      setPubTotal(data.total ?? 0);
      setPubHasNext(data.has_next ?? false);
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: string) {
    setActionLoading(id);
    try {
      await apiDelete(`/api/content/${id}`);
      setActiveItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      // ignore
    }
    setActionLoading(null);
  }

  async function handlePublish(id: string) {
    setActionLoading(id);
    try {
      await apiPost(`/api/content/${id}/publish`);
      await loadActiveItems(activePage);
      if (showHistory) await loadPublishedItems(pubPage);
    } catch {
      // ignore
    }
    setActionLoading(null);
  }

  async function handleSaveEdit(id: string) {
    setActionLoading(id);
    try {
      await apiPatch(`/api/content/${id}`, { body: editBody });
      // Upload image if one was selected
      if (editImageFile) {
        await uploadEditImage(id);
      }
      setEditingId(null);
      setEditImageFile(null);
      setEditImagePreview(null);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
      await loadActiveItems(activePage);
    } catch {
      // ignore
    }
    setActionLoading(null);
  }

  function handleEditImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditImageFile(file);
    setEditImagePreview(URL.createObjectURL(file));
  }

  async function uploadEditImage(contentId: string): Promise<boolean> {
    if (!editImageFile) return false;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", editImageFile);
      const { supabase } = await import("@/lib/supabase");
      const { data: { session } } = await supabase.auth.getSession();
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_URL}/api/content/${contentId}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(err.detail || "Upload failed");
      }
      setUploadingImage(false);
      return true;
    } catch {
      setUploadingImage(false);
      return false;
    }
  }

  async function removeEditImage(contentId: string) {
    try {
      await apiDelete(`/api/content/${contentId}/image`);
      setActiveItems((prev) =>
        prev.map((i) => (i.id === contentId ? { ...i, image_url: null } : i))
      );
    } catch {
      // ignore
    }
    setEditImageFile(null);
    setEditImagePreview(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-warm-500" />
        <span className="text-sm text-gray-400">Loading posts...</span>
      </div>
    );
  }

  if (activeTotal === 0 && pubTotal === 0) {
    return (
      <div className="text-center py-16 animate-fade-in">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 mb-4">
          <FileText className="h-7 w-7 text-gray-400" />
        </div>
        <p className="text-gray-500 mb-1">No posts yet</p>
        <p className="text-sm text-gray-400">
          Go to the Generate tab to create your first post.
        </p>
      </div>
    );
  }

  function renderPostCard(item: ContentItem, idx: number) {
    return (
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
              <span className="text-xs text-gray-400 truncate max-w-[300px]">
                {item.prompt}
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">
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

            {/* Image upload in edit mode */}
            <input
              ref={editFileInputRef}
              type="file"
              accept="image/*"
              onChange={handleEditImageSelect}
              className="hidden"
            />
            {(editImagePreview || item.image_url) ? (
              <div className="relative inline-block">
                <img
                  src={editImagePreview || item.image_url!}
                  alt="Post image"
                  className="max-h-40 rounded-lg border border-gray-200 object-cover"
                />
                <button
                  onClick={() => {
                    if (editImagePreview) {
                      setEditImageFile(null);
                      setEditImagePreview(null);
                      if (editFileInputRef.current) editFileInputRef.current.value = "";
                    } else {
                      removeEditImage(item.id);
                    }
                  }}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => editFileInputRef.current?.click()}
                className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5 border border-dashed border-gray-300 rounded-full text-gray-400 hover:text-[#1a1a1a] hover:border-gray-400 transition-colors"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Add Image
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleSaveEdit(item.id)}
                disabled={actionLoading === item.id || uploadingImage}
                className="btn-primary px-3 py-1.5 text-xs flex items-center gap-1"
              >
                {uploadingImage ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3" />
                )}
                {uploadingImage ? "Uploading..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingId(null);
                  setEditImageFile(null);
                  setEditImagePreview(null);
                  if (editFileInputRef.current) editFileInputRef.current.value = "";
                }}
                className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1 border border-gray-200 rounded-full"
              >
                <XCircle className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-[#1a1a1a]">
              {item.body.length > 500
                ? item.body.slice(0, 500) + "..."
                : item.body}
            </p>
            {item.image_url && (
              <img
                src={item.image_url}
                alt="Post image"
                className="max-h-40 rounded-lg border border-gray-200 object-cover"
              />
            )}
          </>
        )}

        {/* Scheduled info */}
        {item.scheduled_at && item.status === "scheduled" && (
          <p className="text-xs text-amber-600 flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Scheduled for{" "}
            {format(new Date(item.scheduled_at), "MMM d, yyyy h:mm a")}
          </p>
        )}

        {/* Published info */}
        {item.published_at && (
          <p className="text-xs text-green-600 flex items-center gap-1.5">
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
                setEditImageFile(null);
                setEditImagePreview(null);
              }}
              className="btn-ghost px-2.5 py-1 text-xs flex items-center gap-1 border border-gray-200 rounded-full"
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
              className="btn-ghost px-2.5 py-1 text-xs flex items-center gap-1 border border-red-200 rounded-full text-red-500 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl tracking-tight text-[#1a1a1a]">
          My <span className="gradient-text">Posts</span>
        </h2>
        <span className="text-xs text-gray-400">{activeTotal + pubTotal} post{activeTotal + pubTotal !== 1 ? "s" : ""}</span>
      </div>

      {/* Active posts (drafts, approved, scheduled, failed) */}
      {activeItems.length > 0 && (
        <div className="space-y-3">
          {activeItems.map((item, idx) => renderPostCard(item, idx))}
        </div>
      )}

      {/* Active pagination */}
      {activeTotalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setActivePage((p) => Math.max(1, p - 1))}
            disabled={activePage === 1}
            className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1 border border-gray-200 rounded-full disabled:opacity-40"
          >
            <ChevronLeft className="h-3 w-3" />
            Prev
          </button>
          <span className="text-xs text-gray-500">
            Page {activePage} of {activeTotalPages}
          </span>
          <button
            onClick={() => setActivePage((p) => p + 1)}
            disabled={!activeHasNext}
            className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1 border border-gray-200 rounded-full disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* History toggle button */}
      <div className="pt-4">
        <button
          onClick={() => setShowHistory((prev) => !prev)}
          className="btn-ghost w-full py-2.5 text-sm flex items-center justify-center gap-2 border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
        >
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          {showHistory ? "Hide History" : "View Published History"}
          {!showHistory && pubTotal > 0 && (
            <span className="text-xs text-gray-400">({pubTotal})</span>
          )}
        </button>
      </div>

      {/* Published posts section (shown on toggle) */}
      {showHistory && (
        <div className="space-y-3 pt-2 animate-fade-in">
          {publishedItems.length > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h3 className="text-sm font-medium text-gray-500">History</h3>
                <span className="text-xs text-gray-400">({pubTotal})</span>
              </div>
              <div className="border-t border-gray-100" />
              {publishedItems.map((item, idx) => renderPostCard(item, idx))}

              {/* Published pagination */}
              {pubTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setPubPage((p) => Math.max(1, p - 1))}
                    disabled={pubPage === 1}
                    className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1 border border-gray-200 rounded-full disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3 w-3" />
                    Prev
                  </button>
                  <span className="text-xs text-gray-500">
                    Page {pubPage} of {pubTotalPages}
                  </span>
                  <button
                    onClick={() => setPubPage((p) => p + 1)}
                    disabled={!pubHasNext}
                    className="btn-ghost px-3 py-1.5 text-xs flex items-center gap-1 border border-gray-200 rounded-full disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No published posts yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
