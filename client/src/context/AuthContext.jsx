import { useState } from "react";
import { AuthContext } from "./auth-context";

function getInitialAuth() {
  const storedUser = localStorage.getItem("user");
  const storedToken = localStorage.getItem("token");

  if (!storedUser || !storedToken) {
    return {
      user: null,
      token: null,
    };
  }

  try {
    return {
      user: JSON.parse(storedUser),
      token: storedToken,
    };
  } catch {
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    return {
      user: null,
      token: null,
    };
  }
}

export function AuthProvider({ children }) {
  const [{ user, token }, setAuth] = useState(getInitialAuth);
  const authLoading = false;

  const login = (userData, userToken) => {
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", userToken);

    setAuth({
      user: userData,
      token: userToken,
    });
  };

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");

    setAuth({
      user: null,
      token: null,
    });
  };

  const updateUser = (userData) => {
    setAuth((currentAuth) => {
      const nextUser = {
        ...currentAuth.user,
        ...userData,
      };

      localStorage.setItem("user", JSON.stringify(nextUser));

      return {
        ...currentAuth,
        user: nextUser,
      };
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        authLoading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
