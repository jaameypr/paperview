export type UserRole = "admin" | "user";

export interface UserDTO {
  _id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokenPayload {
  userId: string;
  username: string;
  role: UserRole;
  mustChangePassword: boolean;
  iat: number;
  exp: number;
}
