export interface ChatMessage {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  type: "text" | "image" | "location" | "system";
  sentAt: number;
  isRead: boolean;
}

export interface ChatUserInfo {
  id: number;
  uniqueId: string;
  nickname: string;
  avatar?: string | null;
  avatarStyle?: string | null;
  status?: string;
  lastOnline?: Date | string;
}

export interface FriendRequestInfo {
  id: number;
  requesterId: number;
  addresseeId: number;
  status: string;
  createdAt: Date | string;
  requester?: ChatUserInfo | null;
}

// Socket events
export interface ServerToClientEvents {
  "message:receive": (msg: ChatMessage) => void;
  "message:sent": (msg: ChatMessage) => void;
  "typing:indicator": (data: { senderId: number; isTyping: boolean }) => void;
  "user:statusChange": (data: { userId: number; isOnline: boolean }) => void;
  "friend:newRequest": (fromUser: { id: number; nickname: string; uniqueId: string }) => void;
  "friend:requestAccepted": (fromUser: { id: number; nickname: string; uniqueId: string }) => void;
}

export interface ClientToServerEvents {
  "user:online": (data: { id: number; uniqueId: string; nickname: string; avatar?: string }) => void;
  "message:send": (data: { senderId: number; receiverId: number; content: string; type?: "text" | "image" | "location" }) => void;
  "typing:start": (data: { senderId: number; receiverId: number }) => void;
  "typing:stop": (data: { senderId: number; receiverId: number }) => void;
  "friend:request": (data: { targetUserId: number; fromUser: { id: number; nickname: string; uniqueId: string } }) => void;
  "friend:accepted": (data: { targetUserId: number; fromUser: { id: number; nickname: string; uniqueId: string } }) => void;
  "user:checkOnline": (userId: number, callback: (online: boolean) => void) => void;
  "user:getOnlineFriends": (friendIds: number[], callback: (onlineIds: number[]) => void) => void;
}
