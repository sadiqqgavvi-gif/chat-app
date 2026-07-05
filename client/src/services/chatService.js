import api from "./api";

export const fetchChats = async (token) => {
  return api.get("/chat", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const createChat = async (userId, token) => {
  return api.post(
    "/chat",
    {
      userId,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const createGroupChat = async (
  chatName,
  users,
  token
) => {
  return api.post(
    "/chat/group",
    {
      chatName,
      users,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const renameGroupChat = async (
  chatId,
  chatName,
  token
) => {
  return api.put(
    "/chat/group/rename",
    {
      chatId,
      chatName,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const addUserToGroup = async (
  chatId,
  userId,
  token
) => {
  return api.put(
    "/chat/group/add",
    {
      chatId,
      userId,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const removeUserFromGroup = async (
  chatId,
  userId,
  token
) => {
  return api.put(
    "/chat/group/remove",
    {
      chatId,
      userId,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};
