"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { apiPatch, apiDelete, getAuthHeaders } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { useAllContent, useOrgs, useOrgCalendar, useOrgDetail } from "@/lib/queries";
import { useOrgRealtime } from "@/lib/use-realtime";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  getDay,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Pencil,
  Trash2,
  X,
  Save,
  Clock,
  AlertCircle,
  Loader2,
  CalendarDays,
  CalendarRange,
  ImagePlus,
  Image as ImageIcon,
} from "lucide-react";
import PageHeader from "@/components/ui/page-header";

interface ContentItem {
  id: string;
  body: string;
  status: string;
  image_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  user_id?: string;
  member_display_name?: string;
  member_color?: string;
  member_user_id?: string;
}

const STATUS_DOT: Record<string, string> = {
  draft: "bg-gray-400",
  scheduled: "bg-amber-500",
  published: "bg-green-500",
  failed: "bg-red-500",
};

type ViewMode = "month" | "week";

export default function CalendarView() {
  const qc = useQueryClient();
  const orgsQuery = useOrgs();
  const activeOrgId = orgsQuery.data?.active_org_id ?? null;
  const orgCalendarQuery = useOrgCalendar(activeOrgId);
  const orgDetailQuery = useOrgDetail(activeOrgId);
  const contentQuery = useAllContent();

  // Subscribe to real-time updates for the active org
  useOrgRealtime(activeOrgId);

  const isTeamMode = !!activeOrgId;
  const items: ContentItem[] = isTeamMode
    ? (orgCalendarQuery.data?.items ?? [])
    : (contentQuery.data?.items ?? []);
  const loading = isTeamMode ? orgCalendarQuery.isLoading : contentQuery.isLoading;

  // Team member filter
  const orgMembers = orgDetailQuery.data?.members ?? [];
  const [hiddenMembers, setHiddenMembers] = useState<Set<string>>(new Set());

  function toggleMember(userId: string) {
    setHiddenMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const userRole = orgDetailQuery.data?.role ?? "viewer";
  const canEditInOrg = ["owner", "admin", "editor"].includes(userRole);

  // Get current user ID for ownership checks
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id ?? null);
    });
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Image state for editing
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function invalidateContent() {
    qc.invalidateQueries({ queryKey: ["content"] });
    if (activeOrgId) {
      qc.invalidateQueries({ queryKey: ["org-calendar"] });
    }
  }

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const weekDaysRange = useMemo(() => {
    const end = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: currentWeekStart, end });
  }, [currentWeekStart]);

  const startDayOfWeek = getDay(startOfMonth(currentMonth));

  function getItemsForDay(day: Date): ContentItem[] {
    return items.filter((item) => {
      // Team mode: filter by hidden members
      if (isTeamMode && item.member_user_id && hiddenMembers.has(item.member_user_id)) {
        return false;
      }
      const dateStr = item.published_at || item.scheduled_at || item.created_at;
      if (!dateStr) return false;
      return isSameDay(new Date(dateStr), day);
    });
  }

  const selectedDayItems = selectedDay ? getItemsForDay(selectedDay) : [];

  function startEdit(item: ContentItem) {
    setEditingId(item.id);
    setEditBody(item.body);
    setEditImageUrl(item.image_url || null);
    setEditError("");
    if (item.scheduled_at) {
      const d = new Date(item.scheduled_at);
      setEditDate(format(d, "yyyy-MM-dd"));
      setEditTime(format(d, "HH:mm"));
    } else {
      setEditDate(format(new Date(), "yyyy-MM-dd"));
      setEditTime("09:00");
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setEditBody("");
    setEditDate("");
    setEditTime("");
    setEditError("");
    setEditImageUrl(null);
  }

  async function handleImageUpload(contentId: string, file: File) {
    setUploadingImage(true);
    setEditError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const headers = await getAuthHeaders();
      delete headers["Content-Type"];
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/content/${contentId}/image`,
        { method: "POST", headers, body: formData }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || res.statusText);
      }
      const data = await res.json();
      setEditImageUrl(data.image_url);
      invalidateContent();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to upload image");
    }
    setUploadingImage(false);
  }

  async function handleImageRemove(contentId: string) {
    setUploadingImage(true);
    setEditError("");
    try {
      await apiDelete(`/api/content/${contentId}/image`);
      setEditImageUrl(null);
      invalidateContent();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to remove image");
    }
    setUploadingImage(false);
  }

  async function saveEdit() {
    if (!editingId) return;
    if (!editBody.trim()) {
      setEditError("Post content cannot be empty.");
      return;
    }
    setSaving(true);
    setEditError("");
    try {
      const payload: Record<string, unknown> = { body: editBody.trim() };
      if (editDate && editTime) {
        payload.scheduled_at = `${editDate}T${editTime}:00`;
      }
      await apiPatch(`/api/content/${editingId}`, payload);
      invalidateContent();
      cancelEdit();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to save changes");
    }
    setSaving(false);
  }

  async function confirmDelete() {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/content/${deletingId}`);
      setDeletingId(null);
      invalidateContent();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to delete post");
    }
    setDeleting(false);
  }

  const weekDayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const canEdit = (item: ContentItem) => {
    if (item.status === "published") return false;
    if (!isTeamMode) return true;
    // In team mode: viewers cannot edit, editors/admins/owners can edit all org content
    if (userRole === "viewer") return false;
    return canEditInOrg; // true for editor, admin, owner
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={isTeamMode ? "Team" : "Content"}
        titleAccent="Calendar"
        actions={
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode("month")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
                viewMode === "month"
                  ? "bg-white text-[#1a1a1a] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Month
            </button>
            <button
              onClick={() => {
                setViewMode("week");
                setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all ${
                viewMode === "week"
                  ? "bg-white text-[#1a1a1a] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              Week
            </button>
          </div>
        }
      />

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() =>
            viewMode === "month"
              ? setCurrentMonth(subMonths(currentMonth, 1))
              : setCurrentWeekStart(subWeeks(currentWeekStart, 1))
          }
          className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-warm-50 hover:border-warm-200 hover:text-[#1a1a1a] transition-all"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-lg tracking-tight text-[#1a1a1a] font-medium">
          {viewMode === "month"
            ? format(currentMonth, "MMMM yyyy")
            : `${format(currentWeekStart, "MMM d")} – ${format(
                endOfWeek(currentWeekStart, { weekStartsOn: 0 }),
                "MMM d, yyyy"
              )}`}
        </h3>
        <button
          onClick={() =>
            viewMode === "month"
              ? setCurrentMonth(addMonths(currentMonth, 1))
              : setCurrentWeekStart(addWeeks(currentWeekStart, 1))
          }
          className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-warm-50 hover:border-warm-200 hover:text-[#1a1a1a] transition-all"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Team member filter */}
      {isTeamMode && orgMembers.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium">Members:</span>
          {orgMembers.map((m) => (
            <button
              key={m.user_id}
              onClick={() => toggleMember(m.user_id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors ${
                hiddenMembers.has(m.user_id)
                  ? "border-gray-200 text-gray-400 bg-gray-50"
                  : "border-gray-200 text-[#1a1a1a] bg-white shadow-sm"
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  hiddenMembers.has(m.user_id) ? "opacity-30" : ""
                }`}
                style={{ backgroundColor: m.color || "#6366f1" }}
              />
              {m.display_name || "Unknown"}
            </button>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div className="section-card overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {weekDayLabels.map((d) => (
            <div
              key={d}
              className="px-2 py-2.5 text-center text-xs font-medium text-gray-400 uppercase tracking-wider"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Monthly view */}
        {viewMode === "month" && (
          <div className="grid grid-cols-7">
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[80px] border-t border-r border-gray-100 bg-gray-50/50"
              />
            ))}

            {monthDays.map((day) => {
              const dayItems = getItemsForDay(day);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[80px] border-t border-r border-gray-100 p-1.5 text-left transition-all ${
                    isSelected
                      ? "bg-warm-50 border-warm-200"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <span
                    className={`text-xs font-medium inline-flex ${
                      isToday
                        ? "bg-[#1a1a1a] text-white rounded-full w-6 h-6 items-center justify-center"
                        : "text-gray-500"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {dayItems.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {dayItems.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center gap-1">
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isTeamMode && item.member_color ? "" : (STATUS_DOT[item.status] || "bg-[#94a3b8]")
                            }`}
                            style={isTeamMode && item.member_color ? { backgroundColor: item.member_color } : undefined}
                          />
                          <span className="text-[10px] text-gray-400 truncate">
                            {isTeamMode && item.member_display_name
                              ? `${item.member_display_name}: ${item.body.slice(0, 18)}...`
                              : `${item.body.slice(0, 25)}...`}
                          </span>
                        </div>
                      ))}
                      {dayItems.length > 3 && (
                        <span className="text-[10px] text-gray-400">
                          +{dayItems.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Weekly view */}
        {viewMode === "week" && (
          <div className="grid grid-cols-7">
            {weekDaysRange.map((day) => {
              const dayItems = getItemsForDay(day);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, new Date());

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[120px] border-t border-r border-gray-100 p-2 text-left transition-all ${
                    isSelected
                      ? "bg-warm-50 border-warm-200"
                      : "hover:bg-gray-50"
                  } ${!isCurrentMonth ? "bg-gray-50/30" : ""}`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`text-xs font-medium inline-flex ${
                        isToday
                          ? "bg-[#1a1a1a] text-white rounded-full w-6 h-6 items-center justify-center"
                          : "text-gray-500"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    <span className="text-[10px] text-gray-300">
                      {format(day, "EEE")}
                    </span>
                  </div>
                  {dayItems.length > 0 && (
                    <div className="space-y-1">
                      {dayItems.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-center gap-1">
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isTeamMode && item.member_color ? "" : (STATUS_DOT[item.status] || "bg-[#94a3b8]")
                            }`}
                            style={isTeamMode && item.member_color ? { backgroundColor: item.member_color } : undefined}
                          />
                          <span className="text-[10px] text-gray-500 truncate">
                            {isTeamMode && item.member_display_name
                              ? `${item.member_display_name}: ${item.body.slice(0, 25)}...`
                              : `${item.body.slice(0, 35)}...`}
                          </span>
                        </div>
                      ))}
                      {dayItems.length > 5 && (
                        <span className="text-[10px] text-gray-400">
                          +{dayItems.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500 px-1">
            {format(selectedDay, "EEEE, MMMM d, yyyy")}
          </h3>
          {selectedDayItems.length === 0 ? (
            <p className="text-sm text-gray-400">
              No posts for this day.
            </p>
          ) : (
            selectedDayItems.map((item) => {
              const isEditing = editingId === item.id;
              const isDeleteTarget = deletingId === item.id;

              return (
                <div key={item.id} className="section-card p-5 space-y-3">
                  {/* Header row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isTeamMode && item.member_color ? (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                          style={{ backgroundColor: item.member_color }}
                          title={item.member_display_name || undefined}
                        >
                          {(item.member_display_name || "?")[0].toUpperCase()}
                        </div>
                      ) : (
                        <div
                          className={`w-2 h-2 rounded-full ${STATUS_DOT[item.status] || "bg-[#94a3b8]"}`}
                        />
                      )}
                      {isTeamMode && item.member_display_name && (
                        <span className="text-xs font-medium text-gray-500">
                          {item.member_display_name}
                        </span>
                      )}
                      <span className="text-xs font-medium capitalize text-[#1a1a1a]">
                        {item.status}
                      </span>
                      {item.scheduled_at && item.status === "scheduled" && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(item.scheduled_at), "h:mm a")}
                        </span>
                      )}
                    </div>
                    {canEdit(item) && !isEditing && !isDeleteTarget && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => startEdit(item)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-warm-600 hover:bg-warm-50 transition-colors"
                          title="Edit post"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingId(item.id)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete post"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Delete confirmation */}
                  {isDeleteTarget && (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                      <p className="text-sm text-red-600">Remove this post permanently?</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDeletingId(null)}
                          disabled={deleting}
                          className="px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={confirmDelete}
                          disabled={deleting}
                          className="px-3 py-1.5 text-xs rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1 disabled:opacity-50"
                        >
                          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          Delete
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Edit mode */}
                  {isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={6}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-warm-300 focus:border-warm-300 resize-y"
                        placeholder="Post content..."
                      />

                      {/* Image section */}
                      <div className="space-y-2">
                        {editImageUrl ? (
                          <div className="relative inline-block">
                            <img
                              src={editImageUrl}
                              alt="Post image"
                              className="h-24 w-auto rounded-lg border border-gray-200 object-cover"
                            />
                            <button
                              onClick={() => handleImageRemove(item.id)}
                              disabled={uploadingImage}
                              className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm disabled:opacity-50"
                              title="Remove image"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleImageUpload(item.id, f);
                                e.target.value = "";
                              }}
                            />
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingImage}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-warm-300 hover:text-warm-600 transition-colors disabled:opacity-50"
                            >
                              {uploadingImage ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <ImagePlus className="h-3 w-3" />
                              )}
                              {uploadingImage ? "Uploading..." : "Add Image"}
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-gray-500">Date</label>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-warm-300"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-gray-500">Time</label>
                          <input
                            type="time"
                            value={editTime}
                            onChange={(e) => setEditTime(e.target.value)}
                            className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-warm-300"
                          />
                        </div>
                      </div>

                      {editError && (
                        <div className="flex items-center gap-1.5 text-xs text-red-500">
                          <AlertCircle className="h-3 w-3" />
                          {editError}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          className="px-4 py-1.5 text-xs rounded-full bg-warm-500 text-white hover:bg-warm-600 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          Save Changes
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="px-4 py-1.5 text-xs rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                        >
                          <span className="flex items-center gap-1">
                            <X className="h-3 w-3" />
                            Cancel
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    !isDeleteTarget && (
                      <div className="space-y-2">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed text-[#1a1a1a]">
                          {item.body.length > 300
                            ? item.body.slice(0, 300) + "..."
                            : item.body}
                        </p>
                        {item.image_url && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <ImageIcon className="h-3 w-3" />
                            Image attached
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-4">
          <FileText className="h-5 w-5 animate-pulse text-warm-500" />
        </div>
      )}
    </div>
  );
}
