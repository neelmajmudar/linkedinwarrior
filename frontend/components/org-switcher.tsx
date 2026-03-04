"use client";

import { useState, useRef, useEffect } from "react";
import { useOrgs, useCreateOrg, useSwitchOrg } from "@/lib/queries";
import {
  Building2,
  ChevronDown,
  Check,
  Plus,
  User,
  Loader2,
  X,
} from "lucide-react";

interface OrgSwitcherProps {
  collapsed?: boolean;
}

export default function OrgSwitcher({ collapsed = false }: OrgSwitcherProps) {
  const orgsQuery = useOrgs();
  const switchOrg = useSwitchOrg();
  const createOrg = useCreateOrg();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const orgs = orgsQuery.data?.orgs ?? [];
  const activeOrgId = orgsQuery.data?.active_org_id ?? null;
  const activeOrg = orgs.find((o) => o.id === activeOrgId);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleSwitch(orgId: string | null) {
    await switchOrg.mutateAsync(orgId);
    setOpen(false);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const org = await createOrg.mutateAsync({ name: newName.trim() });
      setNewName("");
      setCreating(false);
      setOpen(false);
      // Auto-switch happens on backend, but refresh queries
      await switchOrg.mutateAsync(org.id);
    } catch {
      // error handled by mutation
    }
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setOpen(!open)}
        title={activeOrg ? activeOrg.name : "Personal"}
        className="relative flex items-center justify-center w-full p-1.5"
      >
        {activeOrg ? (
          <Building2 className="h-4 w-4 text-warm-500" />
        ) : (
          <User className="h-4 w-4 text-gray-400" />
        )}
        {open && (
          <div
            ref={ref}
            className="absolute left-full top-0 ml-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
          >
            <DropdownContent
              orgs={orgs}
              activeOrgId={activeOrgId}
              creating={creating}
              newName={newName}
              isCreating={createOrg.isPending}
              isSwitching={switchOrg.isPending}
              onSwitch={handleSwitch}
              onSetCreating={setCreating}
              onSetNewName={setNewName}
              onCreate={handleCreate}
            />
          </div>
        )}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm hover:bg-gray-100 transition-colors"
      >
        {activeOrg ? (
          <Building2 className="h-4 w-4 text-warm-500 flex-shrink-0" />
        ) : (
          <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
        )}
        <span className="text-[#1a1a1a] font-medium truncate flex-1 text-left">
          {activeOrg ? activeOrg.name : "Personal"}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <DropdownContent
            orgs={orgs}
            activeOrgId={activeOrgId}
            creating={creating}
            newName={newName}
            isCreating={createOrg.isPending}
            isSwitching={switchOrg.isPending}
            onSwitch={handleSwitch}
            onSetCreating={setCreating}
            onSetNewName={setNewName}
            onCreate={handleCreate}
          />
        </div>
      )}
    </div>
  );
}

function DropdownContent({
  orgs,
  activeOrgId,
  creating,
  newName,
  isCreating,
  isSwitching,
  onSwitch,
  onSetCreating,
  onSetNewName,
  onCreate,
}: {
  orgs: { id: string; name: string; role: string; member_count: number }[];
  activeOrgId: string | null;
  creating: boolean;
  newName: string;
  isCreating: boolean;
  isSwitching: boolean;
  onSwitch: (id: string | null) => void;
  onSetCreating: (v: boolean) => void;
  onSetNewName: (v: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="py-1">
      {/* Personal option */}
      <button
        onClick={() => onSwitch(null)}
        disabled={isSwitching}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
      >
        <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <span className="flex-1 text-left text-[#1a1a1a]">Personal</span>
        {!activeOrgId && <Check className="h-3.5 w-3.5 text-warm-500" />}
      </button>

      {/* Org list */}
      {orgs.length > 0 && (
        <>
          <div className="mx-3 my-1 border-t border-gray-100" />
          <div className="px-3 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Teams
            </span>
          </div>
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => onSwitch(org.id)}
              disabled={isSwitching}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              <Building2 className="h-4 w-4 text-warm-500 flex-shrink-0" />
              <div className="flex-1 text-left">
                <div className="text-[#1a1a1a] font-medium">{org.name}</div>
                <div className="text-[10px] text-gray-400">
                  {org.member_count} member{org.member_count !== 1 ? "s" : ""} · {org.role}
                </div>
              </div>
              {activeOrgId === org.id && (
                <Check className="h-3.5 w-3.5 text-warm-500 flex-shrink-0" />
              )}
            </button>
          ))}
        </>
      )}

      {/* Create new */}
      <div className="mx-3 my-1 border-t border-gray-100" />
      {creating ? (
        <div className="px-3 py-2 space-y-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => onSetNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreate();
              if (e.key === "Escape") onSetCreating(false);
            }}
            placeholder="Team name..."
            className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-warm-300"
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={onCreate}
              disabled={isCreating || !newName.trim()}
              className="flex items-center gap-1 px-3 py-1 text-xs rounded-full bg-[#1a1a1a] text-white hover:bg-[#333] transition-colors disabled:opacity-50"
            >
              {isCreating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
              Create
            </button>
            <button
              onClick={() => onSetCreating(false)}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => onSetCreating(true)}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-[#1a1a1a] transition-colors"
        >
          <Plus className="h-4 w-4 flex-shrink-0" />
          <span>Create Team</span>
        </button>
      )}
    </div>
  );
}
