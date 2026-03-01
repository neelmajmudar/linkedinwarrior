"use client";

import { useState, useEffect } from "react";
import {
  Mail,
  Inbox,
  Send,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Paperclip,
  Loader2,
  Settings2,
  Zap,
  Tag,
  ListChecks,
  ArrowUpRight,
} from "lucide-react";
import { apiPost } from "@/lib/api";
import {
  useGmailStatus,
  useEmailInbox,
  useEmailDetail,
  useSendEmailReply,
  useEditEmailDraft,
  useReprocessEmail,
  useReprocessAllEmails,
  useEmailAutoSendPreferences,
  useSaveEmailAutoSend,
} from "@/lib/queries";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "question", label: "Questions" },
  { id: "meeting_request", label: "Meetings" },
  { id: "follow_up", label: "Follow-ups" },
  { id: "introduction", label: "Intros" },
  { id: "personal", label: "Personal" },
  { id: "newsletter", label: "Newsletter" },
  { id: "promotional", label: "Promo" },
  { id: "other", label: "Other" },
];

const AUTO_SEND_OPTIONS = [
  { id: "meeting_request", label: "Meeting Requests" },
  { id: "follow_up", label: "Follow-ups" },
  { id: "introduction", label: "Introductions" },
  { id: "question", label: "Questions" },
  { id: "personal", label: "Personal" },
  { id: "other", label: "Other" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-600 bg-red-50 border-red-200",
  medium: "text-amber-600 bg-amber-50 border-amber-200",
  low: "text-gray-500 bg-gray-50 border-gray-200",
};

const CATEGORY_COLORS: Record<string, string> = {
  question: "bg-blue-50 text-blue-700 border-blue-200",
  meeting_request: "bg-purple-50 text-purple-700 border-purple-200",
  follow_up: "bg-amber-50 text-amber-700 border-amber-200",
  introduction: "bg-green-50 text-green-700 border-green-200",
  personal: "bg-pink-50 text-pink-700 border-pink-200",
  newsletter: "bg-gray-50 text-gray-500 border-gray-200",
  promotional: "bg-gray-50 text-gray-500 border-gray-200",
  other: "bg-gray-50 text-gray-600 border-gray-200",
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  new: { icon: Clock, color: "text-gray-400", label: "New" },
  processing: { icon: Loader2, color: "text-blue-500 animate-spin", label: "Processing" },
  processed: { icon: CheckCircle2, color: "text-green-500", label: "Draft Ready" },
  skipped: { icon: AlertCircle, color: "text-gray-400", label: "Skipped" },
  replied: { icon: Send, color: "text-blue-600", label: "Replied" },
};

function formatCategory(cat: string): string {
  return cat
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function EmailPage() {
  const gmailStatus = useGmailStatus();
  const [connecting, setConnecting] = useState(false);
  const [page, setPage] = useState(1);
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const inbox = useEmailInbox(page, 20, activeCategory);
  const emailDetail = useEmailDetail(selectedEmailId);
  const sendReply = useSendEmailReply();
  const editDraft = useEditEmailDraft();
  const reprocess = useReprocessEmail();
  const reprocessAll = useReprocessAllEmails();
  const autoSendPrefs = useEmailAutoSendPreferences();
  const saveAutoSend = useSaveEmailAutoSend();

  const [draftBody, setDraftBody] = useState("");
  const [draftDirty, setDraftDirty] = useState(false);

  // Sync draft body when email detail loads
  useEffect(() => {
    if (emailDetail.data?.draft) {
      setDraftBody(emailDetail.data.draft.body);
      setDraftDirty(false);
    }
  }, [emailDetail.data?.draft]);

  const isConnected = gmailStatus.data?.connected ?? false;

  async function connectGmail() {
    setConnecting(true);
    try {
      const data = await apiPost<{ auth_url: string }>("/api/email/connect");
      if (data.auth_url) {
        const w = 600, h = 700;
        const left = window.screenX + (window.outerWidth - w) / 2;
        const top = window.screenY + (window.outerHeight - h) / 2;
        window.open(
          data.auth_url,
          "gmail-auth",
          `width=${w},height=${h},left=${left},top=${top}`
        );
      }
    } catch (err) {
      console.error("Failed to start Gmail connection:", err);
    } finally {
      setConnecting(false);
    }
  }

  // Listen for connection callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      gmailStatus.refetch();
      window.history.replaceState({}, "", "/dashboard/email");
    }
  }, [gmailStatus]);

  function handleSaveDraft() {
    if (!selectedEmailId || !draftDirty) return;
    editDraft.mutate(
      { emailId: selectedEmailId, body: { body: draftBody } },
      { onSuccess: () => setDraftDirty(false) }
    );
  }

  function handleSendReply() {
    if (!selectedEmailId) return;
    if (draftDirty) {
      editDraft.mutate(
        { emailId: selectedEmailId, body: { body: draftBody } },
        {
          onSuccess: () => {
            setDraftDirty(false);
            sendReply.mutate(selectedEmailId);
          },
        }
      );
    } else {
      sendReply.mutate(selectedEmailId);
    }
  }

  function toggleAutoSend(category: string) {
    const current = autoSendPrefs.data?.auto_send_categories || [];
    const updated = current.includes(category)
      ? current.filter((c) => c !== category)
      : [...current, category];
    saveAutoSend.mutate(updated);
  }

  // ── Not connected state ──
  if (gmailStatus.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <Mail className="h-8 w-8 text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Connect your Gmail</h2>
          <p className="text-gray-500 mt-2 max-w-md">
            Connect your Gmail account to automatically receive, categorize, and draft
            professional replies to your emails using your LinkedIn writing style.
          </p>
        </div>
        <button
          onClick={connectGmail}
          disabled={connecting}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors disabled:opacity-50 font-medium"
        >
          {connecting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Mail className="h-5 w-5" />
          )}
          {connecting ? "Connecting…" : "Connect Gmail"}
        </button>
      </div>
    );
  }

  // ── Settings panel ──
  if (showSettings) {
    const currentAutoSend = autoSendPrefs.data?.auto_send_categories || [];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">Email Settings</h1>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold text-gray-900">Auto-Send Categories</h2>
          </div>
          <p className="text-sm text-gray-500">
            Emails in these categories will have their AI-generated reply automatically sent
            without manual review. Use with caution.
          </p>

          <div className="space-y-2">
            {AUTO_SEND_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                <div
                  className={`relative w-10 h-6 rounded-full transition-colors ${
                    currentAutoSend.includes(opt.id) ? "bg-green-500" : "bg-gray-300"
                  }`}
                  onClick={() => toggleAutoSend(opt.id)}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      currentAutoSend.includes(opt.id) ? "translate-x-4.5" : "translate-x-0.5"
                    }`}
                  />
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Gmail Connection</h2>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-green-700 font-medium">Connected</span>
            {gmailStatus.data?.email_address && (
              <span className="text-gray-500">({gmailStatus.data.email_address})</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Email detail view ──
  if (selectedEmailId) {
    const email = emailDetail.data;
    const isLoading = emailDetail.isLoading;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedEmailId(null)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Inbox
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => reprocess.mutate(selectedEmailId)}
              disabled={reprocess.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reprocess.isPending ? "animate-spin" : ""}`} />
              Regenerate
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : email ? (
          <div className="space-y-4">
            {/* Email header */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-gray-900">{email.subject || "(No subject)"}</h2>
                  <p className="text-sm text-gray-500">
                    From <span className="font-medium text-gray-700">{email.from_name || email.from_email}</span>
                    {email.from_name && (
                      <span className="text-gray-400"> &lt;{email.from_email}&gt;</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{timeAgo(email.received_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {email.category && (
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${CATEGORY_COLORS[email.category] || CATEGORY_COLORS.other}`}>
                      {formatCategory(email.category)}
                    </span>
                  )}
                  {email.priority && (
                    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${PRIORITY_COLORS[email.priority] || PRIORITY_COLORS.medium}`}>
                      {email.priority.charAt(0).toUpperCase() + email.priority.slice(1)}
                    </span>
                  )}
                </div>
              </div>

              {/* Action items */}
              {email.action_items && email.action_items.length > 0 && (
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                    <ListChecks className="h-4 w-4" />
                    Action Items
                  </div>
                  <div className="space-y-1.5">
                    {email.action_items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-sm pl-1"
                      >
                        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                          item.priority === "high" ? "bg-red-400" :
                          item.priority === "medium" ? "bg-amber-400" : "bg-gray-300"
                        }`} />
                        <span className="text-gray-600">{item.item}</span>
                        {item.due && (
                          <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">Due: {item.due}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Original email body */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
              <h3 className="text-sm font-medium text-gray-500">Original Email</h3>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {email.body_text || "(No body)"}
              </div>
            </div>

            {/* Draft reply */}
            {email.draft && email.status !== "skipped" && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <ArrowUpRight className="h-4 w-4 text-blue-500" />
                    AI Draft Reply
                    {email.draft.status === "sent" && (
                      <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">Sent</span>
                    )}
                  </h3>
                </div>

                {email.draft.status === "sent" ? (
                  <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {email.draft.body}
                  </div>
                ) : (
                  <>
                    <textarea
                      value={draftBody}
                      onChange={(e) => {
                        setDraftBody(e.target.value);
                        setDraftDirty(true);
                      }}
                      rows={8}
                      className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-700 resize-y focus:outline-none focus:ring-2 focus:ring-gray-200 leading-relaxed"
                    />
                    <div className="flex items-center justify-end gap-2">
                      {draftDirty && (
                        <button
                          onClick={handleSaveDraft}
                          disabled={editDraft.isPending}
                          className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          {editDraft.isPending ? "Saving…" : "Save Draft"}
                        </button>
                      )}
                      <button
                        onClick={handleSendReply}
                        disabled={sendReply.isPending || !draftBody.trim()}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors disabled:opacity-50"
                      >
                        {sendReply.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Send Reply
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {email.status === "skipped" && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center text-sm text-gray-500">
                This email was classified as <span className="font-medium">{formatCategory(email.category || "")}</span> and skipped for reply generation.
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">Email not found</div>
        )}
      </div>
    );
  }

  // ── Inbox list view ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Email Assistant
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            AI-categorized emails with auto-drafted replies in your voice
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => reprocessAll.mutate()}
            disabled={reprocessAll.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {reprocessAll.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5 text-amber-500" />
            )}
            {reprocessAll.isPending ? "Processing…" : "Process All"}
          </button>
          <button
            onClick={() => inbox.refetch()}
            disabled={inbox.isRefetching}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-gray-600 ${inbox.isRefetching ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            title="Settings"
          >
            <Settings2 className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setActiveCategory(cat.id === "all" ? undefined : cat.id);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              (cat.id === "all" && !activeCategory) || activeCategory === cat.id
                ? "bg-[#1a1a1a] text-white border-[#1a1a1a]"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Email list */}
      {inbox.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !inbox.data?.items?.length ? (
        <div className="text-center py-16 space-y-3">
          <Mail className="h-10 w-10 text-gray-300 mx-auto" />
          <p className="text-gray-400 text-sm">
            {activeCategory ? "No emails in this category" : "No emails yet — they'll appear here as they arrive"}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {inbox.data.items.map((email) => {
            const statusCfg = STATUS_CONFIG[email.status] || STATUS_CONFIG.new;
            const StatusIcon = statusCfg.icon;

            return (
              <button
                key={email.id}
                onClick={() => setSelectedEmailId(email.id)}
                className="w-full text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start gap-3">
                  <StatusIcon className={`h-4 w-4 mt-1 flex-shrink-0 ${statusCfg.color}`} />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {email.from_name || email.from_email}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                        {timeAgo(email.received_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">
                      {email.subject || "(No subject)"}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {email.category && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[email.category] || CATEGORY_COLORS.other}`}>
                          {formatCategory(email.category)}
                        </span>
                      )}
                      {email.priority && email.priority !== "medium" && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${PRIORITY_COLORS[email.priority]}`}>
                          {email.priority === "high" ? "⚡ High" : "Low"}
                        </span>
                      )}
                      {email.has_attachments && (
                        <Paperclip className="h-3 w-3 text-gray-400" />
                      )}
                      {email.action_items && email.action_items.length > 0 && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Tag className="h-3 w-3" />
                          {email.action_items.length} action{email.action_items.length > 1 ? "s" : ""}
                        </span>
                      )}
                      {email.auto_reply_eligible && (
                        <Zap className="h-3 w-3 text-amber-400" />
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {inbox.data && inbox.data.total > 20 && (
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-gray-400">
            Page {page} of {Math.ceil(inbox.data.total / 20)}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!inbox.data.has_next}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
