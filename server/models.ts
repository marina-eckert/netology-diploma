export type ID = number;
export type Role = "client" | "admin" | "manager";
export interface User {
  id: ID;
  _id: ID;
  email: string;
  passwordHash: string;
  name: string;
  contactPhone: string;
  role: Role;
}
export interface SearchUserParams {
  limit: number;
  offset: number;
  email: string;
  name: string;
  contactPhone: string;
}
export interface IUserService {
  create(data: Partial<User>): Promise<User>;
  findById(id: ID): Promise<User>;
  findByEmail(email: string): Promise<User>;
  findAll(params: Partial<SearchUserParams>): Promise<User[]>;
}
export interface Message {
  id: ID;
  _id: ID;
  author: ID;
  authorId: ID;
  supportRequest: ID;
  sentAt: Date;
  text: string;
  readAt: Date | null;
}
export interface SupportRequest {
  id: ID;
  _id: ID;
  user: ID;
  userId: ID;
  createdAt: Date;
  isActive: boolean;
  messages?: Message[];
}
export interface Library {
  id: ID;
  name: string;
  address: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface Book {
  id: ID;
  libraryId: ID;
  title: string;
  author: string;
  year: number | null;
  description: string;
  coverImage: string;
  isAvailable: boolean;
  totalCopies: number;
  availableCopies: number;
}
export type RentalStatus = "reserved" | "active" | "completed" | "cancelled";
export interface BookRental {
  id: ID;
  userId: ID;
  libraryId: ID;
  bookId: ID;
  dateStart: Date;
  dateEnd: Date;
  status: RentalStatus;
  createdAt: Date;
  updatedAt: Date;
}
