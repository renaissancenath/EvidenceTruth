import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@shared/types";
import { api, ApiError } from "./api";

export interface AuthConfig { google: boolean; billing: boolean; pro_price_label: string; free_checks_per_month: number;
  pro_checks_per_month: number; free_documents: number; pro_documents: number }

interface AuthState { user: User | null; loading: boolean; config: AuthConfig | null; refresh: () => Promise<void>; signOut: () => Promise<void> }
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { setUser(await api<User>("/me")); }
    catch (e) { if (e instanceof ApiError && e.status === 401) setUser(null); else throw e; }
    finally { setLoading(false); }
  }, []);
  const signOut = useCallback(async () => { await api("/auth/logout", { method: "POST" }); setUser(null); }, []);
  useEffect(() => {
    void refresh().catch(() => setLoading(false));
    void api<AuthConfig>("/auth/config").then(setConfig).catch(() => undefined);
  }, [refresh]);
  return <Ctx.Provider value={{ user, loading, config, refresh, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
