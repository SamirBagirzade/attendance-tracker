const BASE_URL = "https://app.azpetrol.com:8085";

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
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

export async function findTransactions(body: Record<string, unknown>): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/api/Transaction/find`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Transaction/find HTTP ${res.status}`);
  return res.json();
}

export async function getTransactionById(id: string): Promise<unknown> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}/api/Transaction/${encodeURIComponent(id)}`, {
    headers: { Authorization: `bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Transaction/${id} HTTP ${res.status}`);
  return res.json();
}
