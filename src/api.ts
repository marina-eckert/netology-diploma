export async function api<T = any>(
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
export const send = (method: string, body: any): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
export type User = {
  id: number;
  name: string;
  email: string;
  contactPhone: string;
  role: "client" | "admin" | "manager";
};
export type Library = {
  id: number;
  name: string;
  address: string;
  description: string;
};
export type Book = {
  id: number;
  libraryId: number;
  title: string;
  author: string;
  description: string;
  year: number;
  coverImage: string;
  libraryName: string;
  address: string;
  totalCopies: number;
  availableCopies: number;
  isAvailable: boolean;
};
