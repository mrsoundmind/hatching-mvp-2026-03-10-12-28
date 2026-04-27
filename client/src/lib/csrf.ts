// Client-side CSRF token manager.
// Server sets req.session.csrfToken and exposes it via GET /api/auth/me.
// Server's validateCsrf middleware checks the x-csrf-token header on POST/PUT/PATCH/DELETE.
// This file patches window.fetch once so every mutating same-origin request carries the header.

let cachedToken: string | null = null;
let inflightFetch: Promise<string | null> | null = null;

async function fetchTokenFromServer(): Promise<string | null> {
  try {
    const res = await originalFetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return (data && typeof data.csrfToken === 'string') ? data.csrfToken : null;
  } catch {
    return null;
  }
}

async function getToken(forceRefresh = false): Promise<string | null> {
  if (cachedToken && !forceRefresh) return cachedToken;
  if (inflightFetch) return inflightFetch;
  inflightFetch = fetchTokenFromServer().then((t) => {
    cachedToken = t;
    inflightFetch = null;
    return t;
  });
  return inflightFetch;
}

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const originalFetch = window.fetch.bind(window);

function isSameOriginApi(input: RequestInfo | URL): boolean {
  try {
    const urlStr = typeof input === 'string' ? input
      : input instanceof URL ? input.toString()
      : (input as Request).url;
    const url = new URL(urlStr, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export function installCsrfFetchInterceptor() {
  if ((window as any).__csrfPatched) return;
  (window as any).__csrfPatched = true;

  // Pre-warm the token so the first mutation doesn't pay a round trip.
  void getToken();

  window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const method = (init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
    if (!MUTATION_METHODS.has(method) || !isSameOriginApi(input)) {
      return originalFetch(input, init);
    }
    const token = await getToken();
    const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    if (token) headers.set('x-csrf-token', token);
    // Ensure credentials so the session cookie is present for the CSRF check to see our session.
    const patchedInit: RequestInit = { ...(init || {}), headers, credentials: init?.credentials ?? 'include' };
    let res = await originalFetch(input, patchedInit);
    // If the token was stale (server rotated session), refresh once and retry.
    if (res.status === 403) {
      const body = await res.clone().text().catch(() => '');
      if (body.includes('CSRF')) {
        const fresh = await getToken(true);
        if (fresh && fresh !== token) {
          headers.set('x-csrf-token', fresh);
          res = await originalFetch(input, { ...patchedInit, headers });
        }
      }
    }
    return res;
  };
}
