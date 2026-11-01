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
export type RentalStatus = "reserved" | "active" | "completed" | "cancelled";
export interface Rental {
  id: number;
  bookId: number;
  libraryId: number;
  userId: number;
  title: string;
  author: string;
  coverImage: string;
  libraryName: string;
  userName: string;
  email: string;
  dateStart: string;
  dateEnd: string;
  status: RentalStatus;
}
export interface SupportRequest {
  id: number;
  createdAt: string;
  isActive: boolean;
  hasNewMessages: boolean;
  client?: Pick<User, "id" | "name" | "email" | "contactPhone">;
}
export interface SupportMessage {
  id: number;
  createdAt: string;
  sentAt: string;
  readAt: string | null;
  text: string;
  author: Pick<User, "id" | "name">;
}
