/** ASM API (Postgres product data) */
export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || '/api/v1';

/**
 * nxradar-auth-server — issues httpOnly `accessToken` cookie.
 * Dev default is the Vite proxy (`/auth-api` → :5001) so the browser stays same-origin.
 */
export const AUTH_BASE =
  import.meta.env.VITE_AUTH_BASE_URL || '/auth-api/api/v1';

/** @qvoyant/host product shell */
export const HOST_ORIGIN =
  import.meta.env.VITE_HOST_ORIGIN || 'http://localhost:5173';

export const HOST_ASM_PATH =
  import.meta.env.VITE_HOST_ASM_PATH || `${HOST_ORIGIN}/dashboard/module/asm`;
