"use client";

import { useState } from "react";
import {
  useOrgs,
  useOrgDetail,
  useInviteMember,
  useUpdateMemberRole,
  useRemoveMember,
} from "@/lib/queries";
import type { OrgMember } from "@/lib/queries";
import {
  Users,
  Mail,
  Shield,
  Crown,
  Pencil,
  Eye,
  UserMinus,
  Loader2,
  Send,
  Building2,
  AlertCircle,
  ChevronDown,
  Link2,
  Copy,
  Check,
} from "lucide-react";

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="h-3.5 w-3.5 text-amber-500" />,
  admin: <Shield className="h-3.5 w-3.5 text-blue-500" />,
  editor: <Pencil className="h-3.5 w-3.5 text-green-500" />,
  viewer: <Eye className="h-3.5 w-3.5 text-gray-400" />,
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

export default function TeamPage() {
  const orgsQuery = useOrgs();
  const activeOrgId = orgsQuery.data?.active_org_id ?? null;
  const orgQuery = useOrgDetail(activeOrgId);
  const inviteMember = useInviteMember();
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  const org = orgQuery.data;
  const members = org?.members ?? [];
  const invites = org?.pending_invites ?? [];
  const userRole = org?.role ?? "viewer";
  const canManage = userRole === "owner" || userRole === "admin";

  if (!activeOrgId) {
    return (
      <div className="space-y-6">
        <div className="page-header-gradient rounded-2xl p-6">
          <h2 className="text-2xl tracking-tight text-[#1a1a1a]">
            <span className="gradient-text">Team</span>
          </h2>
        </div>
        <div className="section-card p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center mx-auto">
            <Building2 className="h-6 w-6 text-gray-300" />
          </div>
          <p className="text-gray-500">
            No team selected. Use the org switcher in the sidebar to select or create a team.
          </p>
        </div>
      </div>
    );
  }

  if (orgQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-warm-500" />
      </div>
    );
  }

  async function handleInvite() {
    if (!activeOrgId || !inviteEmail.trim()) return;
    setInviteError("");
    setInviteSuccess("");
    setInviteLink("");
    setLinkCopied(false);
    try {
      const result = await inviteMember.mutateAsync({
        orgId: activeOrgId,
        email: inviteEmail.trim(),
        role: inviteRole,
      }) as { email_sent?: boolean; invite_url?: string };
      if (result.email_sent) {
        setInviteSuccess(`Invitation emailed to ${inviteEmail.trim()}`);
        setTimeout(() => setInviteSuccess(""), 5000);
      } else if (result.invite_url) {
        setInviteLink(result.invite_url);
        setInviteSuccess("Invite created! Email delivery failed — share the link below manually.");
      } else {
        setInviteSuccess(`Invitation created for ${inviteEmail.trim()}`);
        setTimeout(() => setInviteSuccess(""), 5000);
      }
      setInviteEmail("");
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invite");
    }
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
  }

  async function handleRoleChange(userId: string, newRole: string) {
    if (!activeOrgId) return;
    try {
      await updateRole.mutateAsync({ orgId: activeOrgId, userId, role: newRole });
      setEditingRole(null);
    } catch {
      // error handled by mutation
    }
  }

  async function handleRemove(userId: string) {
    if (!activeOrgId) return;
    if (!confirm("Remove this member from the team?")) return;
    try {
      await removeMember.mutateAsync({ orgId: activeOrgId, userId });
    } catch {
      // error handled by mutation
    }
  }

  return (
    <div className="space-y-6">
      <div className="page-header-gradient rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl tracking-tight text-[#1a1a1a]">
            <span className="gradient-text">{org?.name ?? "Team"}</span>
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Users className="h-4 w-4" />
            {members.length} member{members.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Invite section */}
      {canManage && (
        <div className="section-card">
          <div className="p-5 space-y-3">
            <h3 className="text-sm font-medium text-[#1a1a1a] flex items-center gap-2">
              <Mail className="h-4 w-4 text-warm-500" />
              Invite Team Member
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                placeholder="colleague@company.com"
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-warm-300"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-warm-300"
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviteMember.isPending || !inviteEmail.trim()}
                className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5"
              >
                {inviteMember.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Invite
              </button>
            </div>
            {inviteError && (
              <div className="flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle className="h-3 w-3" />
                {inviteError}
              </div>
            )}
            {inviteSuccess && (
              <div className="text-xs text-green-600">{inviteSuccess}</div>
            )}
            {inviteLink && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                <Link2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                <code className="flex-1 text-xs text-gray-600 truncate select-all">{inviteLink}</code>
                <button
                  onClick={copyInviteLink}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border border-gray-200 text-gray-600 hover:bg-white transition-colors flex-shrink-0"
                >
                  {linkCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  {linkCopied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="section-card divide-y divide-gray-100 !p-0">
        <div className="px-5 py-4">
          <h3 className="text-sm font-medium text-[#1a1a1a]">Members</h3>
        </div>
        {members.map((member: OrgMember) => (
          <div
            key={member.id}
            className="flex items-center gap-3 px-5 py-3.5"
          >
            {/* Color dot */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
              style={{ backgroundColor: member.color || "#6366f1" }}
            >
              {(member.display_name || "?")[0].toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#1a1a1a] truncate">
                {member.display_name || "Unknown"}
              </div>
              {member.email && (
                <div className="text-xs text-gray-400 truncate">{member.email}</div>
              )}
            </div>

            {/* Role badge */}
            {editingRole === member.user_id && canManage && member.role !== "owner" ? (
              <div className="relative">
                <select
                  defaultValue={member.role}
                  onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                  onBlur={() => setEditingRole(null)}
                  autoFocus
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-warm-300"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
            ) : (
              <button
                onClick={() => canManage && member.role !== "owner" && setEditingRole(member.user_id)}
                disabled={!canManage || member.role === "owner"}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
              >
                {ROLE_ICONS[member.role]}
                {ROLE_LABELS[member.role] || member.role}
                {canManage && member.role !== "owner" && (
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                )}
              </button>
            )}

            {/* Remove button */}
            {canManage && member.role !== "owner" && (
              <button
                onClick={() => handleRemove(member.user_id)}
                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Remove member"
              >
                <UserMinus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Pending invites */}
      {canManage && invites.length > 0 && (
        <div className="section-card divide-y divide-gray-100 !p-0">
          <div className="px-5 py-4">
            <h3 className="text-sm font-medium text-[#1a1a1a]">Pending Invites</h3>
          </div>
          {invites.map((invite) => (
            <div key={invite.id} className="flex items-center gap-3 px-5 py-3.5">
              <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#1a1a1a] truncate">{invite.email}</div>
                <div className="text-xs text-gray-400">
                  Invited as {invite.role} · Expires{" "}
                  {new Date(invite.expires_at).toLocaleDateString()}
                </div>
              </div>
              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                Pending
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
