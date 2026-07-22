const TOKEN_KEY = "meeting_flow_token";

export function getWorkflowWebSocketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/ws/workflows`;
}

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

  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new Error("无法连接服务器，请确认后端已启动后重试");
  }

  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
  }

  return response;
}

function emptyBodyError(response: Response) {
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    return "后端服务暂时不可用，请稍后重试";
  }
  if (response.status === 401) {
    return "请先登录";
  }
  if (response.status > 0) {
    return `请求失败（HTTP ${response.status}）`;
  }
  return "服务器返回了空响应";
}

/**
 * 安全解析 JSON：避免 `response.json()` 在空响应时抛出
 * `Failed to execute 'json' on 'Response': Unexpected end of JSON input`。
 */
export async function readJson<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    if (!response.ok) {
      throw new Error(emptyBodyError(response));
    }
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.status
        ? `服务器返回了无效响应（HTTP ${response.status}）`
        : "服务器返回了无效响应"
    );
  }
}
