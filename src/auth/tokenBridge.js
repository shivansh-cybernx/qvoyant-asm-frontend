/**
 * Bearer fallback when httpOnly cookie is not visible to JS / cross-port calls.
 * sessionStorage keeps the token across Vite HMR remounts (not localStorage).
 */
const STORAGE_KEY = 'qv_asm_access_token';
let memoryAccessToken = null;

function readStored() {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY);
    return typeof v === 'string' && v.length ? v : null;
  } catch {
    return null;
  }
}

export function setMemoryAccessToken(token) {
  memoryAccessToken = typeof token === 'string' && token.length ? token : null;
  try {
    if (memoryAccessToken) sessionStorage.setItem(STORAGE_KEY, memoryAccessToken);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function getMemoryAccessToken() {
  if (memoryAccessToken) return memoryAccessToken;
  memoryAccessToken = readStored();
  return memoryAccessToken;
}

export function clearMemoryAccessToken() {
  memoryAccessToken = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
