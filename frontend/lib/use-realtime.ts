"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { queryKeys } from "./queries";

/**
 * Subscribe to Supabase Realtime Postgres changes for org-scoped content_items
 * and org_members. On any INSERT/UPDATE/DELETE, invalidates the relevant
 * TanStack Query caches so the calendar and team views stay in sync.
 */
export function useOrgRealtime(orgId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!orgId) return;

    const channel = supabase
      .channel(`org-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "content_items",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: queryKeys.orgCalendar(orgId) });
          qc.invalidateQueries({ queryKey: ["content"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "org_members",
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: queryKeys.orgDetail(orgId) });
          qc.invalidateQueries({ queryKey: queryKeys.orgs });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, qc]);
}
