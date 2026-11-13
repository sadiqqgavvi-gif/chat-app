import api from "../lib/api";

export const searchUsers = (search = "", signal) =>
  api.get("/user", { params: { search }, signal });
export const updateProfile = (profile) => api.put("/user/profile", profile);
export const blockUser = (userId) => api.put("/user/block", { userId });
export const unblockUser = (userId) => api.put("/user/unblock", { userId });
export const fetchBlockedUsers = () => api.get("/user/blocked");
