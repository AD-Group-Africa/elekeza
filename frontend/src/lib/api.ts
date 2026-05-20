// src/lib/api.ts
// Single source of truth for all backend API calls.
// NEVER hardcode localhost here — always use the env var.

const BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window === "undefined"
        ? "http://localhost:8080/api/v1"   // SSR fallback (dev only)
        : "");

if (!BASE_URL && process.env.NODE_ENV === "production") {
  console.error(
      "[elekeza] NEXT_PUBLIC_API_URL is not set. All API calls will fail."
  );
}

// --------------------------------------------------------------------------
// Core fetch wrapper — handles auth header, JSON parsing, and error shape
// --------------------------------------------------------------------------

export interface ApiError {
  status: number;
  message: string;
  code?: string;
}

async function request<T>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
  const token =
      typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Token expired — redirect to login
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    throw { status: 401, message: "Session expired" } as ApiError;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw {
      status: res.status,
      message: body.message ?? "An unexpected error occurred",
      code: body.code,
    } as ApiError;
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// --------------------------------------------------------------------------
// Auth
// --------------------------------------------------------------------------

export const auth = {
  register: (data: { email: string; password: string; name: string }) =>
      request<{ token: string; learnerId: string }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),

  login: (data: { username: string; password: string }) =>
      request<{ token: string; accessToken?: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),

  logout: () => request("/auth/logout", { method: "POST" }),

  refresh: () => request<{ token: string }>("/auth/refresh", { method: "POST" }),
};

// --------------------------------------------------------------------------
// Onboarding
// --------------------------------------------------------------------------

export const onboarding = {
  saveProfile: (data: { preferredLanguage: string; ageGroup: string }) =>
      request("/onboarding/profile", { method: "POST", body: JSON.stringify(data) }),

  savePlacement: (data: { score: number; totalQuestions: number }) =>
      request("/onboarding/placement", { method: "POST", body: JSON.stringify(data) }),

  complete: () => request("/onboarding/complete", { method: "POST" }),
};

// --------------------------------------------------------------------------
// Dashboard / Progress
// --------------------------------------------------------------------------

export const progress = {
  dashboard: () => request("/progress/dashboard"),
  uiConfig: () => request("/ui/config"),
};

// --------------------------------------------------------------------------
// Content / Lessons
// --------------------------------------------------------------------------

export const content = {
  uploadText: (data: { text: string; language: string; title: string }) =>
      request<{ lessonId: string }>("/content/upload/text", {
        method: "POST",
        body: JSON.stringify(data),
      }),

  getLesson: (id: string) => request(`/content/lesson/${id}`),
  getHistory: () => request("/content/history"),
};

// --------------------------------------------------------------------------
// Quiz
// --------------------------------------------------------------------------

export const quiz = {
  generate: (lessonId: string) =>
      request(`/quiz/generate/${lessonId}`, { method: "POST" }),

  submit: (quizId: string, answers: Record<string, string>) =>
      request(`/quiz/submit/${quizId}`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      }),

  review: (quizId: string) => request(`/quiz/review/${quizId}`),
};

// --------------------------------------------------------------------------
// Health (for demo status page)
// --------------------------------------------------------------------------

export const system = {
  health: () => request("/system/health"),
};