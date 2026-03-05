"use client";

import { useState } from "react";
import { useOrgs, useOrgDetail, useUpdateOrg, useDeleteOrg } from "@/lib/queries";
import { useRouter } from "next/navigation";
import {
  Settings,
  Loader2,
  Save,
  Trash2,
  AlertCircle,
  Building2,
} from "lucide-react";

export default function TeamSettingsPage() {
  const router = useRouter();
  const orgsQuery = useOrgs();
  const activeOrgId = orgsQuery.data?.active_org_id ?? null;
  const orgQuery = useOrgDetail(activeOrgId);
  const updateOrg = useUpdateOrg();
  const deleteOrg = useDeleteOrg();

  const [name, setName] = useState("");
  const [nameLoaded, setNameLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const org = orgQuery.data;
  const userRole = org?.role ?? "viewer";
  const canManage = userRole === "owner" || userRole === "admin";
  const isOwner = userRole === "owner";

  // Load name once
  if (org && !nameLoaded) {
    setName(org.name);
    setNameLoaded(true);
  }

  if (!activeOrgId) {
    return (
      <div className="space-y-6">
        <div className="page-header-gradient rounded-2xl p-6">
          <h2 className="text-2xl tracking-tight text-[#1a1a1a]">
            Team <span className="gradient-text">Settings</span>
          </h2>
        </div>
        <div className="section-card p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center mx-auto">
            <Building2 className="h-6 w-6 text-gray-300" />
          </div>
          <p className="text-gray-500">
            No team selected. Use the org switcher in the sidebar to select a team.
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

  if (!canManage) {
    return (
      <div className="space-y-6">
        <div className="page-header-gradient rounded-2xl p-6">
          <h2 className="text-2xl tracking-tight text-[#1a1a1a]">
            Team <span className="gradient-text">Settings</span>
          </h2>
        </div>
        <div className="section-card p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center mx-auto">
            <Settings className="h-6 w-6 text-gray-300" />
          </div>
          <p className="text-gray-500">
            Only admins and owners can manage team settings.
          </p>
        </div>
      </div>
    );
  }

  async function handleSave() {
    if (!activeOrgId || !name.trim()) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateOrg.mutateAsync({ orgId: activeOrgId, body: { name: name.trim() } });
      setSuccess("Settings saved successfully.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!activeOrgId) return;
    try {
      await deleteOrg.mutateAsync(activeOrgId);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete organization");
      setConfirmDelete(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="page-header-gradient rounded-2xl p-6">
        <h2 className="text-2xl tracking-tight text-[#1a1a1a]">
          Team <span className="gradient-text">Settings</span>
        </h2>
      </div>

      {/* General settings */}
      <div className="section-card">
        <div className="p-5 space-y-4">
          <h3 className="text-sm font-medium text-[#1a1a1a] flex items-center gap-2">
            <Settings className="h-4 w-4 text-warm-500" />
            General
          </h3>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Team Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="w-full max-w-md rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-warm-300"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-500">Slug</label>
            <p className="text-sm text-gray-400">{org?.slug}</p>
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" />
              {error}
            </div>
          )}
          {success && (
            <div className="text-xs text-green-600">{success}</div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Danger zone — owner only */}
      {isOwner && (
        <div className="section-card border-red-100">
          <div className="p-5 space-y-4">
            <h3 className="text-sm font-medium text-red-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Danger Zone
            </h3>

            {confirmDelete ? (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 space-y-3">
                <p className="text-sm text-red-700">
                  This will permanently delete <strong>{org?.name}</strong> and remove all members. Content items will remain but lose their org association. This action cannot be undone.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleteOrg.isPending}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {deleteOrg.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Yes, Delete Organization
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-4 py-2 text-sm rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Organization
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
