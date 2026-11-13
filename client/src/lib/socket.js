import { io } from "socket.io-client";
import { SOCKET_URL } from "./api";

const socket = io(SOCKET_URL, {
  autoConnect: false,
  // Read the token at connection time so reconnects after a fresh login
  // always use the current session.
  auth: (callback) => callback({ token: localStorage.getItem("token") }),
});

export default socket;
