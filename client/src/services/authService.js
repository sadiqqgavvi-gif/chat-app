import api from "../lib/api";

export const registerUser = (data) => api.post("/auth/register", data);
export const loginUser = (data) => api.post("/auth/login", data);
export const fetchMe = () => api.get("/auth/me");
export const changePassword = (currentPassword, newPassword) =>
  api.put("/auth/password", { currentPassword, newPassword });
