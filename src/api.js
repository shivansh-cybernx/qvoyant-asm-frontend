import { getMemoryAccessToken } from './auth/tokenBridge.js';

// Prefer same-origin /api/v1 (Vite proxies to backend) so auth cookie is sent.
const API = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 15000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { timeoutMs: _ignored, headers, ...rest } = options;
    const memoryToken = getMemoryAccessToken();

    const res = await fetch(`${API}${path}`, {
      credentials: 'include',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        ...(memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {}),
        ...(headers || {}),
      },
      ...rest,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(body.message || res.statusText || `HTTP ${res.status}`);
      error.status = res.status;
      error.details = body.details;
      throw error;
    }
    return body;
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out talking to ${API}${path}`);
    }
    if (err instanceof TypeError || /failed to fetch/i.test(String(err?.message || err))) {
      throw new Error(
        `Backend unreachable at ${API}. Start Postgres (docker compose up -d postgres redis) then pnpm dev in qvoyant-asm-backend.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export { API };
