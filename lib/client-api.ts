export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

/**
 * 统一的客户端 JSON 请求封装：
 * - 禁用浏览器缓存；
 * - 把后端/网络错误转换成适合直接展示的中文消息；
 * - AbortError 原样抛出，交给调用方忽略。
 */
export async function requestJson<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(input, {
      cache: "no-store",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiRequestError(
      "无法连接服务器，请确认开发服务仍在运行后重试。",
      0,
    );
  }

  let payload: unknown = null;
  const body = await response.text();
  if (body) {
    try {
      payload = JSON.parse(body) as unknown;
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const serverMessage =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : null;

    throw new ApiRequestError(
      serverMessage ?? `请求失败（HTTP ${response.status}），请稍后再试。`,
      response.status,
    );
  }

  return payload as T;
}

export function getErrorMessage(
  error: unknown,
  fallback = "请求失败，请稍后重试。",
): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
