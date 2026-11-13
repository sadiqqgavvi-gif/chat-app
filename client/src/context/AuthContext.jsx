import { useCallback, useEffect, useMemo, useState } from "react";
import { AuthContext } from "./contexts";
import { onUnauthorized } from "../lib/api";
import { fetchMe } from "../services/authService";

function readStoredAuth() {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    const token = localStorage.getItem("token");
    if (user?.id && token) return { user, token };
  } catch {
    // fall through to signed-out state
  }
  localStorage.removeItem("user");
  localStorage.removeItem("token");
  return { user: null, token: null };
}

export function AuthProvider({ children }) {
  const [{ user, token }, setAuth] = useState(readStoredAuth);

  const login = useCallback((nextUser, nextToken) => {
    localStorage.setItem("user", JSON.stringify(nextUser));
    localStorage.setItem("token", nextToken);
    setAuth({ user: nextUser, token: nextToken });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    setAuth({ user: null, token: null });
  }, []);

  const updateUser = useCallback((changes) => {
    setAuth((current) => {
      if (!current.user) return current;
      const nextUser = { ...current.user, ...changes };
      localStorage.setItem("user", JSON.stringify(nextUser));
      return { ...current, user: nextUser };
    });
  }, []);

  useEffect(() => {
    onUnauthorized(logout);
  }, [logout]);

  // Refresh the cached profile once per session; a rejected token signs
  // the user out through the 401 handler above.
  useEffect(() => {
    if (!token) return;
    fetchMe()
      .then((response) => updateUser(response.data))
      .catch(() => {});
  }, [token, updateUser]);

  const value = useMemo(
    () => ({ user, token, login, logout, updateUser }),
    [user, token, login, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
