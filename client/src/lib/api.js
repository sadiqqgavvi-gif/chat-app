import axios from "axios";

// Same-origin by default (Vite proxies /api in development, and the
// server can serve the built client in production). Set VITE_API_URL to
// an absolute URL when the API is hosted on a different domain.
const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export const SERVER_ORIGIN = /^https?:/.test(API_URL) ? new URL(API_URL).origin : "";

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || SERVER_ORIGIN || undefined;

const api = axios.create({ baseURL: API_URL });

let unauthorizedHandler = () => {};
export const onUnauthorized = (handler) => {
  unauthorizedHandler = handler;
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // An expired or revoked session anywhere in the app signs the user out.
    if (error.response?.status === 401 && localStorage.getItem("token")) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  },
);

export const errorMessage = (error, fallback = "Something went wrong") => {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.request && !error.response) {
    return "Can't reach the server. Check your connection and try again.";
  }
  return fallback;
};

// Uploaded files are stored as server-relative paths.
export const fileUrl = (url, { download = false } = {}) => {
  if (!url) return "";
  if (!url.startsWith("/api/")) return url;
  return `${SERVER_ORIGIN}${url}${download ? "?download=1" : ""}`;
};

export default api;
