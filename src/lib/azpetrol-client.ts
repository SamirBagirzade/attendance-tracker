const BASE_URL = "https://app.azpetrol.com:8085";

let tokenCache: { token: string; expiresAt: number } | null = null;

// Azpetrol only allows one active session per customer — a login from anywhere else
// (another process, a manual test, etc.) silently invalidates our cached token before
// its own JWT expiry. getToken(force) lets callers bypass the cache to recover from that.
async function getToken(force = false): Promise<string> {
  if (!force && tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const res = await fetch(`${BASE_URL}/api/Security/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerNumber: process.env.AZP_CUSTOMER_NUMBER,
      apikey: process.env.AZP_API_KEY,
    }),
  });

  if (!res.ok) throw new Error(`Azpetrol login HTTP ${res.status}`);
  const json = await res.json();
  if (!json.isSuccess) throw new Error(json.message || "Azpetrol login failed");

  const token: string = json.data;
  const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  tokenCache = { token, expiresAt: payload.exp * 1000 - 60_000 };

  return token;
}

async function authedFetch(url: string, init: RequestInit): Promise<Response> {
  let token = await getToken();
  let res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `bearer ${token}` } });

  if (res.status === 401) {
    // Cached token was invalidated server-side (not yet expired by our clock) — force a fresh login and retry once.
    token = await getToken(true);
    res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `bearer ${token}` } });
  }

  return res;
}

export async function findTransactions(body: Record<string, unknown>): Promise<unknown> {
  const res = await authedFetch(`${BASE_URL}/api/Transaction/find`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Transaction/find HTTP ${res.status}`);
  return res.json();
}

export async function getTransactionById(id: string): Promise<unknown> {
  const res = await authedFetch(`${BASE_URL}/api/Transaction/${encodeURIComponent(id)}`, {});
  if (!res.ok) throw new Error(`Transaction/${id} HTTP ${res.status}`);
  return res.json();
}
