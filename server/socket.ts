import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import * as db from "./db";

interface OnlineUser {
  id: number;
  uniqueId: string;
  nickname: string;
  avatar?: string;
  socketId: string;
}

// Online users map: chatUserId -> OnlineUser
const onlineUsers = new Map<number, OnlineUser>();
// Socket to user mapping
const socketToUser = new Map<string, number>();

let io: Server;

export function getIO() {
  return io;
}

export function setupSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/api/socket.io",
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    // User comes online
    socket.on("user:online", (data: { id: number; uniqueId: string; nickname: string; avatar?: string }) => {
      const user: OnlineUser = { ...data, socketId: socket.id };
      onlineUsers.set(data.id, user);
      socketToUser.set(socket.id, data.id);

      // Update last online in DB
      db.updateLastOnline(data.id);

      // Notify friends that user is online
      broadcastOnlineStatus(data.id, true);
    });

    // Send private message
    socket.on("message:send", async (data: { senderId: number; receiverId: number; content: string; type?: "text" | "image" }) => {
      // Save to database
      const msg = await db.saveMessage({
        senderId: data.senderId,
        receiverId: data.receiverId,
        content: data.content,
        type: data.type || "text",
      });

      if (!msg) return;

      // Send to receiver if online
      const receiver = onlineUsers.get(data.receiverId);
      if (receiver) {
        io.to(receiver.socketId).emit("message:receive", {
          id: msg.id,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          content: msg.content,
          type: msg.type,
          sentAt: msg.sentAt,
          isRead: false,
        });
      }

      // Confirm to sender
      socket.emit("message:sent", {
        id: msg.id,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        content: msg.content,
        type: msg.type,
        sentAt: msg.sentAt,
        isRead: false,
      });
    });

    // Typing indicator
    socket.on("typing:start", (data: { senderId: number; receiverId: number }) => {
      const receiver = onlineUsers.get(data.receiverId);
      if (receiver) {
        io.to(receiver.socketId).emit("typing:indicator", { senderId: data.senderId, isTyping: true });
      }
    });

    socket.on("typing:stop", (data: { senderId: number; receiverId: number }) => {
      const receiver = onlineUsers.get(data.receiverId);
      if (receiver) {
        io.to(receiver.socketId).emit("typing:indicator", { senderId: data.senderId, isTyping: false });
      }
    });

    // Friend request notification
    socket.on("friend:request", (data: { targetUserId: number; fromUser: { id: number; nickname: string; uniqueId: string } }) => {
      const target = onlineUsers.get(data.targetUserId);
      if (target) {
        io.to(target.socketId).emit("friend:newRequest", data.fromUser);
      }
    });

    // Friend request accepted notification
    socket.on("friend:accepted", (data: { targetUserId: number; fromUser: { id: number; nickname: string; uniqueId: string } }) => {
      const target = onlineUsers.get(data.targetUserId);
      if (target) {
        io.to(target.socketId).emit("friend:requestAccepted", data.fromUser);
      }
    });

    // Check if user is online
    socket.on("user:checkOnline", (userId: number, callback: (online: boolean) => void) => {
      callback(onlineUsers.has(userId));
    });

    // Get online friends
    socket.on("user:getOnlineFriends", (friendIds: number[], callback: (onlineIds: number[]) => void) => {
      const onlineIds = friendIds.filter(id => onlineUsers.has(id));
      callback(onlineIds);
    });

    // Disconnect
    socket.on("disconnect", () => {
      const userId = socketToUser.get(socket.id);
      if (userId) {
        onlineUsers.delete(userId);
        socketToUser.delete(socket.id);
        broadcastOnlineStatus(userId, false);
        db.updateLastOnline(userId);
      }
    });
  });
}

function broadcastOnlineStatus(userId: number, isOnline: boolean) {
  // Broadcast to all connected sockets
  io.emit("user:statusChange", { userId, isOnline });
}
