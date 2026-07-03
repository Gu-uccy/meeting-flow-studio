const TOKEN_KEY = "meeting_flow_token";

export async function apiClient(url: string, options?: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {};

  if (options?.headers) {
    const incoming = options.headers as Record<string, string>;
    for (const [key, value] of Object.entries(incoming)) {
      headers[key] = value;
    }
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (options?.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
  }

  return response;
}
