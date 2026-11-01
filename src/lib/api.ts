export async function api<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const r = await fetch("/api" + url, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const data = await r.json().catch(() => null);
  if (!r.ok)
    throw new Error(
      Array.isArray(data?.message)
        ? data.message.join(", ")
        : data?.message || "Не удалось выполнить запрос",
    );
  return data;
}
export const send = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
