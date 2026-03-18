export async function apiRequest(path, options = {}) {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const normalizedPath = path.startsWith("http")
    ? path
    : `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const response = await fetch(normalizedPath, {
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