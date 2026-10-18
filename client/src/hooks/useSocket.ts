import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "../../../shared/chat-types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: TypedSocket | null = null;

export function getSocket(): TypedSocket | null {
  return globalSocket;
}

export function useSocket() {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<TypedSocket | null>(null);

  useEffect(() => {
    if (globalSocket && globalSocket.connected) {
      socketRef.current = globalSocket;
      setConnected(true);
      return;
    }

    const socket: TypedSocket = io({
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setConnected(true);
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    globalSocket = socket;
    socketRef.current = socket;

    return () => {
      // Keep connection alive
    };
  }, []);

  const goOnline = useCallback((user: { id: number; uniqueId: string; nickname: string; avatar?: string }) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("user:online", user);
  }, []);

  return {
    socket: socketRef.current,
    connected,
    goOnline,
  };
}
