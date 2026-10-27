import { API_BASE, AUTH_BASE } from './config.js';

/**
 * Step 1: validate email/password and request OTP.
 * nxradar-auth-server: POST /api/v1/auth/generateotp
 */
export async function loginWithPassword({ email, password }) {
  let res;
  try {
    res = await fetch(`${AUTH_BASE}/auth/generateotp`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new Error(
      `Auth server unreachable at ${AUTH_BASE}. Start nxradar-auth-server (default http://localhost:5001).`,
    );
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const err = new Error(body.message || body.error || `Login failed (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  const data = body.data || {};
  // Auth always requires OTP next (demo mode still needs DEMO_OTP on /login).
  return {
    mfaRequired: true,
    mfaChallengeToken: null,
    mfaMethod: data.demo ? 'demo-otp' : 'email-otp',
    message:
      body.message ||
      (data.demo
        ? 'Enter the demo OTP to finish signing in.'
        : 'Enter the verification code sent to your email.'),
  };
}

/**
 * Step 2: validate OTP and create session cookie.
 * nxradar-auth-server: POST /api/v1/auth/login  { email, password, otp }
 */
export async function verifyMfa({ email, password, code }) {
  const res = await fetch(`${AUTH_BASE}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, otp: code }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const err = new Error(body.message || body.error || `MFA verification failed (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return sessionFromAuthPayload(body.data || body);
}

/** Auth-server forgot-password. Response is always generic to avoid account enumeration. */
export async function requestPasswordReset(email) {
  const res = await fetch(`${AUTH_BASE}/auth/password/forgot`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  await res.json().catch(() => ({}));
}

function sessionFromAuthPayload(data) {
  return {
    mfaRequired: false,
    user: data.user || null,
    organizationId: data.organizationId || null,
    authToken: typeof data.authToken === 'string' ? data.authToken : null,
  };
}

/** End NXRadar session cookie on auth-server + clear ASM local cookie leftovers. */
export async function logoutSession(memoryToken = null) {
  const headers = {
    Accept: 'application/json',
    ...(memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {}),
  };

  await Promise.allSettled([
    fetch(`${AUTH_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers,
    }),
    fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers,
    }),
  ]);
}

/** Session probe against ASM API (reads httpOnly cookie or Bearer). */
export async function fetchAsmMe(memoryToken = null) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || 'Not authenticated');
    err.status = res.status;
    throw err;
  }
  return body.data || body;
}
