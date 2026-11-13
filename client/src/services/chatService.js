import api from "../lib/api";

export const fetchChats = () => api.get("/chat");
export const fetchChat = (chatId) => api.get(`/chat/${chatId}`);
export const accessChat = (userId) => api.post("/chat", { userId });
export const createGroup = (data) => api.post("/chat/group", data);
export const updateGroup = (chatId, data) => api.put(`/chat/${chatId}/group`, data);
export const addMembers = (chatId, userIds) =>
  api.put(`/chat/${chatId}/members/add`, { userIds });
export const removeMember = (chatId, userId) =>
  api.put(`/chat/${chatId}/members/remove`, { userId });
export const setAdmin = (chatId, userId, admin) =>
  api.put(`/chat/${chatId}/admins`, { userId, admin });
export const leaveGroup = (chatId) => api.post(`/chat/${chatId}/leave`);
export const updateChatPrefs = (chatId, prefs) => api.put(`/chat/${chatId}/prefs`, prefs);
export const markChatRead = (chatId) => api.put(`/chat/${chatId}/read`);
export const clearChat = (chatId) => api.put(`/chat/${chatId}/clear`);
export const deleteChat = (chatId) => api.delete(`/chat/${chatId}`);
