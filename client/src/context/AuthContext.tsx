import { useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "./auth";
import type { User } from "../types";
function readUser(): User | null {
  try { const value = JSON.parse(localStorage.getItem("user") || "null"); return localStorage.getItem("token") && value?.id && typeof value.name === "string" && ["customer", "provider", "admin"].includes(value.role) ? value : null; } catch { return null; }
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(readUser);
  useEffect(() => {
    const clear = () => setUser(null);
    const sync = () => setUser(readUser());
    window.addEventListener("localtrust:unauthorized", clear);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("localtrust:unauthorized", clear); window.removeEventListener("storage", sync); };
  }, []);
  const login = (token: string, nextUser: User) => { localStorage.setItem("token", token); localStorage.setItem("user", JSON.stringify(nextUser)); setUser(nextUser); };
  const logout = () => { localStorage.removeItem("token"); localStorage.removeItem("user"); setUser(null); };
  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

