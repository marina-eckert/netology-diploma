import type { Book, Library, User } from "../../types";
export type ResourceKind = "books" | "libraries" | "users";
export type ManagementRecord = { id: number } & Partial<Book & Library & User>;
export type ManagementDraft = Partial<ManagementRecord>;
export const resourceNames: Record<ResourceKind, string> = {
  books: "Книги",
  libraries: "Библиотеки",
  users: "Пользователи",
};
