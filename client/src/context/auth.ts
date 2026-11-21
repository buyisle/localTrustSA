import { createContext, useContext } from "react";
import type { User } from "../types";

export const AuthContext = createContext<{
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
} | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is required");
  return context;
}
