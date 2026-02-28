import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPatch, apiDelete } from "./api";

// ── Keys ──

export const queryKeys = {
  persona: ["persona"] as const,
  linkedinStatus: ["linkedin-status"] as const,
  contentActive: (page: number) => ["content", "active", page] as const,
  contentPublished: (page: number) => ["content", "published", page] as const,
  contentPublishedCount: ["content", "published-count"] as const,
  contentAll: ["content", "all"] as const,
  engagementTopics: ["engagement", "topics"] as const,
  engagementRemaining: ["engagement", "remaining"] as const,
  engagementHistory: (page: number) => ["engagement", "history", page] as const,
  engagementHistoryCount: ["engagement", "history-count"] as const,
  analytics: ["analytics"] as const,
  creatorReports: ["creator-reports"] as const,
  creatorReport: (id: string) => ["creator-report", id] as const,
  taskStatus: (id: string) => ["task", id] as const,
};

// ── Persona / Onboarding ──

export function usePersona() {
  return useQuery({
    queryKey: queryKeys.persona,
    queryFn: () =>
      apiGet<{ voice_profile: unknown; linkedin_username: string | null }>(
        "/api/persona"
      ),
    retry: false,
  });
}

export function useLinkedinStatus() {
  return useQuery({
    queryKey: queryKeys.linkedinStatus,
    queryFn: () => apiGet<{ connected: boolean }>("/api/linkedin/status"),
    retry: false,
  });
}

// ── Content (posts) ──

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

interface PaginatedContent {
  items: ContentItem[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export function useActiveContent(page: number, pageSize = 10) {
  return useQuery({
    queryKey: queryKeys.contentActive(page),
    queryFn: () =>
      apiGet<PaginatedContent>(
        `/api/content?exclude_status=published&page=${page}&page_size=${pageSize}`
      ),
  });
}

export function usePublishedContent(page: number, pageSize = 10, enabled = true) {
  return useQuery({
    queryKey: queryKeys.contentPublished(page),
    queryFn: () =>
      apiGet<PaginatedContent>(
        `/api/content?status=published&page=${page}&page_size=${pageSize}`
      ),
    enabled,
  });
}

export function usePublishedContentCount() {
  return useQuery({
    queryKey: queryKeys.contentPublishedCount,
    queryFn: async () => {
      const data = await apiGet<PaginatedContent>(
        `/api/content?status=published&page=1&page_size=1`
      );
      return data.total ?? 0;
    },
  });
}

export function useAllContent() {
  return useQuery({
    queryKey: queryKeys.contentAll,
    queryFn: () =>
      apiGet<{ items: ContentItem[] }>("/api/content?page=1&page_size=100"),
  });
}

// ── Engagement ──

export function useEngagementTopics() {
  return useQuery({
    queryKey: queryKeys.engagementTopics,
    queryFn: () => apiGet<{ topics: string[] }>("/api/engagement/topics"),
  });
}

export function useEngagementRemaining() {
  return useQuery({
    queryKey: queryKeys.engagementRemaining,
    queryFn: () =>
      apiGet<{ remaining_today: number; daily_limit: number }>(
        "/api/engagement/remaining"
      ),
  });
}

interface HistoryResponse {
  comments: {
    id: string;
    post_social_id: string;
    post_author: string;
    post_content: string;
    comment_text: string;
    status: string;
    created_at: string;
    share_url?: string;
    post_author_url?: string;
  }[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
  remaining_today: number;
  daily_limit: number;
}

export function useEngagementHistory(page: number, pageSize = 10, enabled = true) {
  return useQuery({
    queryKey: queryKeys.engagementHistory(page),
    queryFn: () =>
      apiGet<HistoryResponse>(
        `/api/engagement/history?status=posted&page=${page}&page_size=${pageSize}`
      ),
    enabled,
  });
}

export function useEngagementHistoryCount() {
  return useQuery({
    queryKey: queryKeys.engagementHistoryCount,
    queryFn: async () => {
      const data = await apiGet<HistoryResponse>(
        `/api/engagement/history?status=posted&page=1&page_size=1`
      );
      return data.total;
    },
  });
}

export function useSaveTopics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (topics: string[]) =>
      apiPost("/api/engagement/topics", { topics }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.engagementTopics });
    },
  });
}

// ── Analytics ──

interface AnalyticsData {
  summary: {
    total_posts: number;
    total_reactions: number;
    total_comments: number;
    total_reposts: number;
    total_impressions: number;
    avg_engagement_rate: number;
  };
  follower_history: { followers_count: number; snapshot_date: string }[];
  top_posts: {
    id: string;
    linkedin_post_id: string;
    post_text: string;
    reactions: number;
    comments: number;
    reposts: number;
    impressions: number;
    snapshot_date: string;
  }[];
  metric_trends: {
    date: string;
    impressions: number;
    reactions: number;
    comments: number;
    reposts: number;
    post_count: number;
    engagement_rate: number;
  }[];
}

export function useAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics,
    queryFn: () => apiGet<AnalyticsData>("/api/analytics"),
  });
}

export function useRefreshAnalytics() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost("/api/analytics/refresh"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.analytics });
    },
  });
}

// ── Creator Research ──

interface ReportListItem {
  id: string;
  niche: string;
  creators_analyzed: { name: string; public_identifier: string; headline: string; post_count: number }[];
  status: string;
  error_message: string | null;
  created_at: string;
}

export function useCreatorReports() {
  return useQuery({
    queryKey: queryKeys.creatorReports,
    queryFn: () =>
      apiGet<{ reports: ReportListItem[] }>("/api/creator-analysis/reports"),
  });
}

export function useCreatorReport(id: string | null) {
  return useQuery({
    queryKey: queryKeys.creatorReport(id || ""),
    queryFn: () => apiGet<Record<string, unknown>>(`/api/creator-analysis/reports/${id}`),
    enabled: !!id,
  });
}

export function useDeleteCreatorReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiDelete(`/api/creator-analysis/reports/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.creatorReports });
    },
  });
}

// ── Content mutations ──

export function useDeleteContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/content/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content"] });
    },
  });
}

export function usePublishContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost(`/api/content/${id}/publish`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content"] });
    },
  });
}

export function usePatchContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiPatch(`/api/content/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content"] });
    },
  });
}

// ── Task polling ──

export function useTaskStatus(taskId: string | null, interval = 3000) {
  return useQuery({
    queryKey: queryKeys.taskStatus(taskId || ""),
    queryFn: () =>
      apiGet<{
        task_id: string;
        status: string;
        result?: Record<string, unknown>;
        error?: string;
      }>(`/api/tasks/${taskId}`),
    enabled: !!taskId,
    refetchInterval: interval,
    refetchIntervalInBackground: true,
  });
}
