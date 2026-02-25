"use client";

import { useState, useRef, useEffect } from "react";
import { apiPost, apiGet, apiPatch, apiDelete } from "@/lib/api";
import {
  Send,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Clock,
  Rocket,
  Save,
  ImagePlus,
  X,
} from "lucide-react";

export default function PostGenerator() {
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [showScheduler, setShowScheduler] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll for task completion when a generate task is in-flight
  useEffect(() => {
    if (!taskId) return;
    const interval = setInterval(async () => {
      try {
        const data = await apiGet<{
          task_id: string;
          status: string;
          result?: { draft_id?: string; body?: string; prompt?: string };
          error?: string;
        }>(`/api/tasks/${taskId}`);
        if (data.status === "completed" && data.result) {
          setDraft(data.result.body || "");
          setDraftId(data.result.draft_id || null);
          setIsGenerating(false);
          setTaskId(null);
        } else if (data.status === "failed") {
          setError(data.error || "Generation failed");
          setIsGenerating(false);
          setTaskId(null);
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [taskId]);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setDraft("");
    setDraftId(null);
    setError("");
    setMessage("");

    try {
      const data = await apiPost<{ task_id: string }>(
        "/api/content/generate-async",
        { prompt }
      );
      setTaskId(data.task_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setIsGenerating(false);
    }
  }

  async function handleRegenerate() {
    if (draftId) {
      try {
        const { apiDelete } = await import("@/lib/api");
        await apiDelete(`/api/content/${draftId}`);
      } catch {
        // ignore
      }
    }
    handleGenerate();
  }

  async function handleSaveDraft() {
    if (!draftId) return;
    try {
      await apiPatch(`/api/content/${draftId}`, { body: draft });
      setMessage("Draft saved");
      setTimeout(() => setMessage(""), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function handlePublishNow() {
    if (!draftId) return;
    setPublishing(true);
    setError("");
    try {
      // Save latest edits first
      await apiPatch(`/api/content/${draftId}`, { body: draft });
      // Auto-upload image if selected but not yet attached
      if (imageFile) {
        const uploaded = await uploadImage();
        if (!uploaded) {
          setPublishing(false);
          return;
        }
      }
      await apiPost(`/api/content/${draftId}/publish`);
      setMessage("Published to LinkedIn!");
      setDraft("");
      setDraftId(null);
      setPrompt("");
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    }
    setPublishing(false);
  }

  async function handleSchedule() {
    if (!draftId || !scheduleDate) return;
    setScheduling(true);
    setError("");
    try {
      await apiPatch(`/api/content/${draftId}`, { body: draft });
      // Auto-upload image if selected but not yet attached
      if (imageFile) {
        const uploaded = await uploadImage();
        if (!uploaded) {
          setScheduling(false);
          return;
        }
      }
      await apiPost(`/api/content/${draftId}/schedule`, {
        scheduled_at: new Date(scheduleDate).toISOString(),
      });
      setMessage("Post scheduled!");
      setDraft("");
      setDraftId(null);
      setPrompt("");
      setShowScheduler(false);
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to schedule");
    }
    setScheduling(false);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function uploadImage(targetDraftId?: string): Promise<boolean> {
    const id = targetDraftId || draftId;
    if (!id || !imageFile) return false;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);

      const { supabase } = await import("@/lib/supabase");
      const { data: { session } } = await supabase.auth.getSession();
      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_URL}/api/content/${id}/image`, {
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
      setUploadingImage(false);
      return false;
    }
  }

  async function handleImageUpload() {
    if (!draftId || !imageFile) return;
    const ok = await uploadImage();
    if (ok) {
      setMessage("Image attached");
      setTimeout(() => setMessage(""), 2000);
    }
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (draftId) {
      apiDelete(`/api/content/${draftId}/image`).catch(() => {});
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const charCount = draft.length;
  const charLimit = 3000;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl tracking-tight text-[#1a1a1a] mb-1">
          Generate a <span className="gradient-text">Post</span>
        </h2>
        <p className="text-sm text-gray-500">
          Describe what you want to post about. The AI will write it in your
          voice.
        </p>
      </div>

      {/* Prompt input */}
      <div className="glass-card p-4 flex gap-3">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !isGenerating && handleGenerate()}
          placeholder="e.g. Share my thoughts on why most startups fail at hiring..."
          className="input-field flex-1"
          disabled={isGenerating}
        />
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="btn-primary px-5 py-2.5 flex items-center gap-2 text-sm shrink-0"
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Generate
        </button>
      </div>

      {/* Draft editor */}
      {(draft || isGenerating) && (
        <div className="glass-card p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-500">
              Draft
              {isGenerating && (
                <span className="ml-2 text-warm-400 animate-pulse">
                  generating...
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <span
                className={
                  charCount > charLimit
                    ? "text-red-500"
                    : "text-gray-400"
                }
              >
                {charCount.toLocaleString()}/{charLimit.toLocaleString()}
              </span>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={12}
            className="input-field resize-y font-mono text-sm leading-relaxed !p-4"
            disabled={isGenerating}
          />

          {/* Action buttons */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5 border border-gray-200 rounded-full disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
              <button
                onClick={handleCopy}
                className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5 border border-gray-200 rounded-full"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={handleSaveDraft}
                disabled={!draftId}
                className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5 border border-gray-200 rounded-full disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowScheduler(!showScheduler)}
                disabled={!draftId || isGenerating}
                className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5 border border-gray-200 rounded-full disabled:opacity-50"
              >
                <Clock className="h-3.5 w-3.5" />
                Schedule
              </button>
              <button
                onClick={handlePublishNow}
                disabled={!draftId || isGenerating || publishing}
                className="btn-primary px-4 py-1.5 text-sm flex items-center gap-1.5"
              >
                {publishing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Rocket className="h-3.5 w-3.5" />
                )}
                Post Now
              </button>
            </div>
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="Post image preview"
                  className="max-h-40 rounded-lg border border-gray-200 object-cover"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {draftId && imageFile && (
                  <button
                    onClick={handleImageUpload}
                    disabled={uploadingImage}
                    className="absolute bottom-2 right-2 btn-primary px-2.5 py-1 text-xs flex items-center gap-1"
                  >
                    {uploadingImage ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    {uploadingImage ? "Uploading" : "Attach"}
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isGenerating}
                className="btn-ghost px-3 py-1.5 text-sm flex items-center gap-1.5 border border-dashed border-gray-300 rounded-full disabled:opacity-50 text-gray-400 hover:text-[#1a1a1a] hover:border-gray-400 transition-colors"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                Add Image
              </button>
            )}
          </div>

          {/* Schedule picker */}
          {showScheduler && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="input-field !w-auto"
              />
              <button
                onClick={handleSchedule}
                disabled={!scheduleDate || scheduling}
                className="btn-primary px-4 py-1.5 text-sm flex items-center gap-1.5"
              >
                {scheduling ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Clock className="h-3.5 w-3.5" />
                )}
                Confirm
              </button>
            </div>
          )}
        </div>
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
