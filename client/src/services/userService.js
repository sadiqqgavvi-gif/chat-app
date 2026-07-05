import api from "./api";

export const searchUsers = async (search, token) => {
  return api.get(`/user?search=${encodeURIComponent(search)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const updateProfile = async (profile, token) => {
  return api.put("/user/profile", profile, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};
