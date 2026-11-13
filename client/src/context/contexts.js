import { createContext, useContext } from "react";

export const AuthContext = createContext(null);
export const ThemeContext = createContext(null);
export const ToastContext = createContext(null);
export const ChatContext = createContext(null);
export const CallContext = createContext(null);

const use = (context, name) => {
  const value = useContext(context);
  if (!value) throw new Error(`${name} must be used inside its provider`);
  return value;
};

export const useAuth = () => use(AuthContext, "useAuth");
export const useTheme = () => use(ThemeContext, "useTheme");
export const useToast = () => use(ToastContext, "useToast");
export const useChat = () => use(ChatContext, "useChat");
export const useCall = () => use(CallContext, "useCall");
