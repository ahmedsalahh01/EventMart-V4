const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000").trim();

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path;

  const normalizedBase = API_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBase}${normalizedPath}`;
}

export async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const url = buildUrl(path);
  console.log("Frontend API URL:", url);

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();

  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { error: text || "Invalid server response" };
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.details ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function authRequest(path, token, options = {}) {
  return apiRequest(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
}

export async function sendAIPlannerMessage(data) {
  return apiRequest("/api/ai-planner", {
    method: "POST",
    body: data
  });
}