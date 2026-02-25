"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { apiGet } from "@/lib/api";
import { CheckCircle2, AlertCircle, X, PenTool, MessageSquare, Sparkles } from "lucide-react";

// --- Types ---

export type TaskType = "generate" | "engage" | "research";
export type TabId = "generate" | "engage" | "research";

export interface TaskNotification {
  task_id: string;
  task_type: TaskType;
  status: "completed" | "failed";
  error: string | null;
  meta: Record<string, unknown>;
  result?: unknown;
  completed_at: string;
}

export interface ActiveTask {
  task_id: string;
  task_type: TaskType;
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
  error?: string | null;
  meta?: Record<string, unknown>;
}

interface TaskNotificationContextValue {
  notifications: TaskNotification[];
  dismiss: (taskId: string) => void;
  dismissAll: () => void;
  navigateTo: ((tab: TabId) => void) | null;
  setNavigateTo: (fn: (tab: TabId) => void) => void;
  registerTask: (taskType: TaskType, taskId: string, meta?: Record<string, unknown>) => void;
  getActiveTask: (taskType: TaskType) => ActiveTask | null;
  consumeTask: (taskType: TaskType) => ActiveTask | null;
}

// --- Context ---

const TaskNotificationContext = createContext<TaskNotificationContextValue>({
  notifications: [],
  dismiss: () => {},
  dismissAll: () => {},
  navigateTo: null,
  setNavigateTo: () => {},
  registerTask: () => {},
  getActiveTask: () => null,
  consumeTask: () => null,
});

export function useTaskNotifications() {
  return useContext(TaskNotificationContext);
}

// --- Provider ---

const POLL_INTERVAL = 4000;

export function TaskNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const sinceRef = useRef<string>(new Date().toISOString());
  const seenRef = useRef<Set<string>>(new Set());
  const [navigateFn, setNavigateFn] = useState<((tab: TabId) => void) | null>(null);

  // Persistent active-task map: survives child component unmount/remount
  const activeTasksRef = useRef<Map<TaskType, ActiveTask>>(new Map());
  // Counter to force re-render when activeTasksRef changes
  const [, setTaskTick] = useState(0);
  const bumpTick = useCallback(() => setTaskTick((t) => t + 1), []);

  const registerTask = useCallback((taskType: TaskType, taskId: string, meta?: Record<string, unknown>) => {
    activeTasksRef.current.set(taskType, {
      task_id: taskId,
      task_type: taskType,
      status: "pending",
      meta,
    });
    bumpTick();
  }, [bumpTick]);

  const getActiveTask = useCallback((taskType: TaskType): ActiveTask | null => {
    return activeTasksRef.current.get(taskType) || null;
  }, []);

  const consumeTask = useCallback((taskType: TaskType): ActiveTask | null => {
    const task = activeTasksRef.current.get(taskType) || null;
    activeTasksRef.current.delete(taskType);
    bumpTick();
    return task;
  }, [bumpTick]);

  const setNavigateTo = useCallback((fn: (tab: TabId) => void) => {
    setNavigateFn(() => fn);
  }, []);

  const dismiss = useCallback((taskId: string) => {
    setNotifications((prev) => prev.filter((n) => n.task_id !== taskId));
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await apiGet<{ tasks: TaskNotification[] }>(
          `/api/tasks/notifications?since=${encodeURIComponent(sinceRef.current)}`
        );
        const newTasks = (data.tasks || []).filter(
          (t) => !seenRef.current.has(t.task_id)
        );
        if (newTasks.length > 0) {
          let changed = false;
          for (const t of newTasks) {
            seenRef.current.add(t.task_id);
            // Update activeTask entry if it matches
            const active = activeTasksRef.current.get(t.task_type as TaskType);
            if (active && active.task_id === t.task_id) {
              active.status = t.status;
              active.result = t.result;
              active.error = t.error;
              changed = true;
            }
          }
          if (changed) bumpTick();
          setNotifications((prev) => [...prev, ...newTasks]);
          const latest = newTasks.reduce(
            (max, t) => (t.completed_at > max ? t.completed_at : max),
            sinceRef.current
          );
          sinceRef.current = latest;
        }
      } catch {
        // ignore auth / network errors silently
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [bumpTick]);

  // Auto-dismiss after 15 seconds
  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = setTimeout(() => {
      setNotifications((prev) => {
        if (prev.length === 0) return prev;
        return prev.slice(1);
      });
    }, 15000);
    return () => clearTimeout(timer);
  }, [notifications]);

  return (
    <TaskNotificationContext.Provider
      value={{
        notifications,
        dismiss,
        dismissAll,
        navigateTo: navigateFn,
        setNavigateTo,
        registerTask,
        getActiveTask,
        consumeTask,
      }}
    >
      {children}
      <NotificationToasts />
    </TaskNotificationContext.Provider>
  );
}

// --- Toast UI ---

const TASK_LABELS: Record<string, { label: string; icon: React.ReactNode; tab: TabId }> = {
  generate: {
    label: "Post Generation",
    icon: <PenTool className="h-4 w-4" />,
    tab: "generate",
  },
  engage: {
    label: "Engagement Search",
    icon: <MessageSquare className="h-4 w-4" />,
    tab: "engage",
  },
  research: {
    label: "Creator Research",
    icon: <Sparkles className="h-4 w-4" />,
    tab: "research",
  },
};

function NotificationToasts() {
  const { notifications, dismiss, navigateTo } = useTaskNotifications();

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      {notifications.map((n) => {
        const info = TASK_LABELS[n.task_type] || TASK_LABELS.generate;
        const isSuccess = n.status === "completed";
        const meta = n.meta || {};
        let description = "";
        if (n.task_type === "generate" && meta.prompt) {
          description = `"${String(meta.prompt).slice(0, 60)}${String(meta.prompt).length > 60 ? "..." : ""}"`;
        } else if (n.task_type === "engage" && meta.topics) {
          const topics = meta.topics as string[];
          description = topics.slice(0, 3).join(", ");
        } else if (n.task_type === "research" && meta.niche) {
          description = String(meta.niche).slice(0, 60);
        }

        return (
          <div
            key={n.task_id}
            className={`rounded-xl border shadow-lg p-4 flex items-start gap-3 animate-fade-in cursor-pointer transition-all hover:shadow-xl ${
              isSuccess
                ? "bg-white border-green-200"
                : "bg-white border-red-200"
            }`}
            onClick={() => {
              if (navigateTo) {
                navigateTo(info.tab);
              }
              dismiss(n.task_id);
            }}
          >
            <div
              className={`mt-0.5 shrink-0 ${
                isSuccess ? "text-green-600" : "text-red-500"
              }`}
            >
              {isSuccess ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">{info.icon}</span>
                <span className="text-sm font-medium text-[#1a1a1a]">
                  {info.label} {isSuccess ? "Complete" : "Failed"}
                </span>
              </div>
              {description && (
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {description}
                </p>
              )}
              {n.error && (
                <p className="text-xs text-red-500 mt-0.5 truncate">
                  {n.error}
                </p>
              )}
              <p className="text-[10px] text-gray-400 mt-1">
                Click to view →
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismiss(n.task_id);
              }}
              className="shrink-0 p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

