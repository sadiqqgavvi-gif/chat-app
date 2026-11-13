import api from "../lib/api";

export const fetchMessages = (chatId, params) =>
  api.get(`/message/chat/${chatId}`, { params });
export const searchMessages = (chatId, q, signal) =>
  api.get(`/message/chat/${chatId}/search`, { params: { q }, signal });
export const fetchMedia = (chatId) => api.get(`/message/chat/${chatId}/media`);
export const fetchStarred = () => api.get("/message/starred");
export const sendMessage = (data) => api.post("/message", data);
export const forwardMessages = (messageIds, chatIds) =>
  api.post("/message/forward", { messageIds, chatIds });
export const editMessage = (messageId, content) =>
  api.put(`/message/${messageId}/edit`, { content });
export const reactToMessage = (messageId, emoji) =>
  api.put(`/message/${messageId}/react`, { emoji });
export const starMessage = (messageId, starred) =>
  api.put(`/message/${messageId}/star`, { starred });
export const deleteMessage = (messageId, scope) =>
  api.delete(`/message/${messageId}`, { params: { scope } });

export const uploadFile = (file, name, onProgress) => {
  const form = new FormData();
  form.append("file", file, name);
  return api.post("/upload", form, {
    onUploadProgress: (event) => {
      if (event.total) onProgress?.(event.loaded / event.total);
    },
  });
};
