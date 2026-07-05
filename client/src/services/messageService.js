import api from "./api";

export const sendMessage = async (
  content,
  chatId,
  token,
  options = {}
) => {
  return api.post(
    "/message",
    {
      content,
      chatId,
      attachments: options.attachments || [],
      replyTo: options.replyTo || null,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const fetchMessages = async (chatId, token) => {
  return api.get(`/message/${chatId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const markMessagesAsRead = async (chatId, token) => {
  return api.put(
    "/message/read",
    {
      chatId,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const deleteMessageForMe = async (
  messageId,
  token
) => {
  return api.put(
    `/message/delete/${messageId}`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const deleteMessageForEveryone = async (
  messageId,
  token
) => {
  return api.put(
    `/message/delete-everyone/${messageId}`,
    {},
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const editMessage = async (
  messageId,
  content,
  token
) => {
  return api.put(
    `/message/edit/${messageId}`,
    { content },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};
