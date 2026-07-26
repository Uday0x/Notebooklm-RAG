import { API_BASE_URL } from "../config/env";

export class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function apiUrl(path) {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${safePath}`;
}

export async function request(path, options = {}) {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined;

  if (hasBody && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
    body:
      hasBody && !(options.body instanceof FormData) && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok || data?.success === false) {
    throw new ApiError(data?.message || response.statusText || "Request failed", {
      status: response.status,
      data,
    });
  }

  return data?.data ?? data;
}

export const api = {
  health: () => request("/health"),
  ready: () => request("/ready"),
  config: () => request("/api/config"),
  notebooks: () => request("/api/notebooks"),
  notebook: (id) => request(`/api/notebooks/${id}`),
  createNotebook: (body) => request("/api/notebooks", { method: "POST", body }),
  updateNotebook: (id, body) => request(`/api/notebooks/${id}`, { method: "PATCH", body }),
  deleteNotebook: (id) => request(`/api/notebooks/${id}`, { method: "DELETE" }),
  notebookStats: (id) => request(`/api/notebooks/${id}/stats`),
  sources: (notebookId) => request(`/api/notebooks/${notebookId}/sources`),
  source: (id) => request(`/api/sources/${id}`),
  sourceStatus: (id) => request(`/api/sources/${id}/status`),
  createSource: (notebookId, body) =>
    request(`/api/notebooks/${notebookId}/sources`, { method: "POST", body }),
  uploadSource: (notebookId, formData) =>
    request(`/api/notebooks/${notebookId}/sources/upload`, {
      method: "POST",
      body: formData,
    }),
  updateSource: (id, body) => request(`/api/sources/${id}`, { method: "PATCH", body }),
  deleteSource: (id) => request(`/api/sources/${id}`, { method: "DELETE" }),
  conversations: (notebookId) => request(`/api/notebooks/${notebookId}/conversations`),
  conversation: (id) => request(`/api/conversations/${id}`),
  createConversation: (notebookId, body = {}) =>
    request(`/api/notebooks/${notebookId}/conversations`, { method: "POST", body }),
  updateConversation: (id, body) =>
    request(`/api/conversations/${id}`, { method: "PATCH", body }),
  deleteConversation: (id) => request(`/api/conversations/${id}`, { method: "DELETE" }),
  messages: (conversationId, params = {}) => {
    const search = new URLSearchParams(params);
    const suffix = search.toString() ? `?${search}` : "";
    return request(`/api/conversations/${conversationId}/messages${suffix}`);
  },
};
