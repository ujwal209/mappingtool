/**
 * Unified API Configuration
 *
 * Normalizes backend URLs across local development and production deployments.
 * Guarantees that whether NEXT_PUBLIC_API_URL is configured as:
 *   - "https://backend.vercel.app"
 *   - "https://backend.vercel.app/"
 *   - "https://backend.vercel.app/api/v1"
 *   - "https://backend.vercel.app/api/v1/"
 *
 * Both API_ROOT (origin) and API_V1 (origin + /api/v1) are always correct,
 * without double "/api/v1/api/v1" or missing "/api/v1" paths.
 */

function resolveApiOrigin(): string {
  const raw = (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    ""
  ).trim();

  if (raw) {
    return raw.replace(/\/+$/, "").replace(/\/api\/v1\/?$/, "");
  }

  // Browser runtime fallback
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:8000";
    }
    // In production without an env var, use current origin (same-origin proxy)
    return "";
  }

  // Server-side fallback
  return process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:8000";
}

export const API_ROOT = resolveApiOrigin();
export const API_V1 = API_ROOT ? `${API_ROOT}/api/v1` : "/api/v1";

/**
 * Returns the fully qualified URL for any API endpoint.
 * Automatically handles whether the caller passed a path with or without `/api/v1`.
 */
export function getApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized.startsWith("/api/v1/")) {
    return `${API_ROOT}${normalized}`;
  }
  return `${API_V1}${normalized}`;
}
