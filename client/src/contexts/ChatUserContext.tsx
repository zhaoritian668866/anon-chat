import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { ChatUserInfo } from "../../../shared/chat-types";

const STORAGE_KEY = "anon_chat_user";

interface ChatUserContextType {
  user: ChatUserInfo | null;
  setUser: (user: ChatUserInfo | null) => void;
  logout: () => void;
  isLoggedIn: boolean;
}

const ChatUserContext = createContext<ChatUserContextType>({
  user: null,
  setUser: () => {},
  logout: () => {},
  isLoggedIn: false,
});

export function ChatUserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<ChatUserInfo | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });

  const setUser = (u: ChatUserInfo | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <ChatUserContext.Provider value={{ user, setUser, logout, isLoggedIn: !!user }}>
      {children}
    </ChatUserContext.Provider>
  );
}

export function useChatUser() {
  return useContext(ChatUserContext);
}
