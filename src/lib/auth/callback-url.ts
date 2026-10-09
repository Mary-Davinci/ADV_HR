export const DEFAULT_AUTHENTICATED_PATH = "/dashboard";

/**
 * Accetta solo percorsi interni per evitare open redirect
 * (es. `//evil.com`, `https://evil.com`, `/\\evil.com`).
 */
export function getSafeCallbackUrl(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/api/auth")) {
    return DEFAULT_AUTHENTICATED_PATH;
  }
  return value;
}
