/**
 * Prefer same-origin (Vite HTTPS proxy) so phones work without mixed-content blocks.
 * Override with VITE_SERVER_URL only when the API is on a different public host.
 */
function resolveServerUrl(): string {
  const fromEnv = (import.meta.env.VITE_SERVER_URL || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost:3002';
}

const serverUrl = resolveServerUrl();
const authToken = (import.meta.env.VITE_AUTH_TOKEN || '').trim();

export const clientConfig = {
  serverUrl,
  authToken,
  apiUrl: serverUrl,
};
