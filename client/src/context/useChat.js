import { useContext } from "react";
import { ChatContext } from "./chat-context";

export function useChat() {
  return useContext(ChatContext);
}
