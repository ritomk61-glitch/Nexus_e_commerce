import { API_BASE_URL } from "@/config/env.js";
import { getAuthToken } from "@/firebase/auth.js";

/**
 * Robust REST client for the NEXUS Node/Express backend.
 * Safely consumes response body only once to prevent 'body stream already read' errors.
 */
export async function http(path, { method = "GET", body, token, headers = {} } = {}) {
  const authToken =
    token || (typeof window !== "undefined" ? await getAuthToken().catch(() => null) : null);

  const reqHeaders = {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...headers,
  };

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  try {
    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Safely read response text once to avoid "body stream already read" errors
    const rawText = await res.text();
    let data = null;
    if (rawText && rawText.trim()) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }
    }

    if (!res.ok) {
      let errMsg = `Request failed (${res.status})`;
      if (data && (data.error || data.message)) {
        errMsg = data.error || data.message;
      } else if (res.status === 502) {
        errMsg = "Backend server is unavailable (502 Bad Gateway).";
      } else if (rawText && rawText.trim()) {
        const cleanText = rawText.replace(/<[^>]*>/g, "").trim().slice(0, 150);
        if (cleanText) errMsg = cleanText;
      }
      throw new Error(errMsg);
    }

    return data !== null ? data : {};
  } catch (err) {
    if (
      (err.name === "TypeError" && err.message.includes("fetch")) ||
      err.message.includes("502") ||
      err.message.includes("Failed to fetch") ||
      err.message.includes("NetworkError")
    ) {
      console.warn(
        `[NEXUS API] Could not connect to backend server at ${url} (${err.message}). Falling back to local data.`,
      );
      throw new Error("Unable to reach NEXUS backend API server. Falling back to local data.");
    }
    throw err;
  }
}

export const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
