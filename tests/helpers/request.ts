export async function parseJsonResponse<T>(response: Response): Promise<{
  status: number;
  body: T;
}> {
  const body = (await response.json()) as T;
  return { status: response.status, body };
}

export function jsonRequest(
  url: string,
  method: string,
  payload: unknown,
): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
