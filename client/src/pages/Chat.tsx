import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle, Users, Settings, Search, UserPlus, Send, Smile, X,
  ArrowLeft, Check, XCircle, Copy, LogOut, ChevronRight, Menu, Bell,
  Image as ImageIcon, MapPin, Loader2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useChatUser } from "@/contexts/ChatUserContext";
import { useSocket } from "@/hooks/useSocket";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/useMobile";
import type { ChatMessage, ChatUserInfo } from "../../../shared/chat-types";

// Emoji categories
const emojiCategories = [
  { name: "常用", emojis: ["😀","😂","🥰","😎","🤔","👍","❤️","🎉","🔥","💯","😊","🙏","😭","🥺","✨","💪","🤣","😘","🫡","👋"] },
  { name: "表情", emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","😉","😊","😇","🥰","😍","🤩","😘","😋","😛","🤔","🤫","🤭","😏","😌","😴","🥱","😷","🤒","🤕","🤢","🤮"] },
  { name: "手势", emojis: ["👍","👎","👊","✊","🤛","🤜","👏","🙌","🤝","🤲","🙏","✌️","🤞","🤟","🤘","👌","🤌","👈","👉","👆","👇","☝️","✋","🤚","🖐️","🖖","👋","🤙","💪"] },
  { name: "爱心", emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","💕","💞","💓","💗","💖","💘","💝","💟"] },
  { name: "动物", emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🦄","🐝","🦋","🐌"] },
];

// Location message bubble component
function LocationBubble({ content, isMine }: { content: string; isMine: boolean }) {
  let lat = 0, lng = 0;
  try {
    const data = JSON.parse(content);
    lat = data.lat;
    lng = data.lng;
  } catch {
    return <span>定位消息</span>;
  }

  // 使用OpenStreetMap瓦片生成静态地图预览（国内可访问，无需API key）
  const zoom = 14;
  const tileX = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  const tileY = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * Math.pow(2, zoom)
  );
  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;

  // 高德地图链接（国内用户通用）
  const amapUrl = `https://uri.amap.com/marker?position=${lng},${lat}&name=共享位置`;
  // 腾讯地图备用链接
  const qqMapUrl = `https://apis.map.qq.com/uri/v1/marker?marker=coord:${lat},${lng};title:共享位置&referer=anonchat`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <MapPin className={`w-3.5 h-3.5 ${isMine ? "text-green-200" : "text-green-600"}`} />
        <span className="text-xs">位置分享</span>
      </div>
      <div className="w-[200px] h-[120px] rounded-lg overflow-hidden border border-white/20 relative">
        <img
          src={tileUrl}
          alt="地图预览"
          className="w-full h-full object-cover"
          onError={(e) => {
            // 图片加载失败时显示坐标信息
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).parentElement!.classList.add('bg-green-50', 'flex', 'items-center', 'justify-center');
          }}
        />
        <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <MapPin className="w-5 h-5 text-red-500 drop-shadow-lg" />
        </div>
      </div>
      <div className="flex gap-2">
        <a
          href={amapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-[10px] underline ${isMine ? "text-green-200" : "text-green-600"}`}
        >
          高德地图
        </a>
        <a
          href={qqMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-[10px] underline ${isMine ? "text-green-200" : "text-green-600"}`}
        >
          腾讯地图
        </a>
      </div>
    </div>
  );
}

export default function Chat() {
  const [, navigate] = useLocation();
  const { user, logout: logoutUser } = useChatUser();
  const { socket, connected, goOnline } = useSocket();
  const isMobile = useIsMobile();
  const utils = trpc.useUtils();

  // State
  const [activeTab, setActiveTab] = useState<"chats" | "friends" | "settings">("chats");
  const [activeChatFriend, setActiveChatFriend] = useState<ChatUserInfo | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTab, setEmojiTab] = useState(0);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addFriendId, setAddFriendId] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(true);
  const [onlineFriends, setOnlineFriends] = useState<Set<number>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sendingLocation, setSendingLocation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) navigate("/");
  }, [user, navigate]);

  // Go online when socket connects
  useEffect(() => {
    if (connected && user) {
      goOnline({ id: user.id, uniqueId: user.uniqueId, nickname: user.nickname, avatar: user.avatar || undefined });
    }
  }, [connected, user, goOnline]);

  // tRPC queries
  const friendsQuery = trpc.friend.list.useQuery(
    { userId: user?.id || 0 },
    { enabled: !!user, refetchInterval: 10000 }
  );
  const pendingRequestsQuery = trpc.friend.pendingRequests.useQuery(
    { userId: user?.id || 0 },
    { enabled: !!user, refetchInterval: 5000 }
  );

  const friends = friendsQuery.data || [];
  const pendingRequests = pendingRequestsQuery.data || [];

  const friendIds = useMemo(() => friends.map(f => f.id), [friends]);

  const chatListQuery = trpc.message.chatList.useQuery(
    { userId: user?.id || 0, friendIds },
    { enabled: !!user && friendIds.length > 0, refetchInterval: 5000 }
  );
  const chatList = chatListQuery.data || [];

  // History query for active chat
  const historyQuery = trpc.message.getHistory.useQuery(
    { userId1: user?.id || 0, userId2: activeChatFriend?.id || 0 },
    { enabled: !!user && !!activeChatFriend }
  );

  // Load chat history when switching friends
  useEffect(() => {
    if (historyQuery.data) {
      setChatMessages(historyQuery.data as ChatMessage[]);
    }
  }, [historyQuery.data]);

  // Mark messages as read
  const markReadMutation = trpc.message.markRead.useMutation();
  useEffect(() => {
    if (activeChatFriend && user) {
      markReadMutation.mutate({ senderId: activeChatFriend.id, receiverId: user.id });
    }
  }, [activeChatFriend, user]);

  // Check online friends
  useEffect(() => {
    if (socket && connected && friendIds.length > 0) {
      socket.emit("user:getOnlineFriends", friendIds, (onlineIds) => {
        setOnlineFriends(new Set(onlineIds));
      });
    }
  }, [socket, connected, friendIds]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    const handleReceive = (msg: ChatMessage) => {
      if (activeChatFriend && (msg.senderId === activeChatFriend.id || msg.receiverId === activeChatFriend.id)) {
        setChatMessages(prev => [...prev, msg]);
        // Mark as read immediately
        if (user && msg.senderId === activeChatFriend.id) {
          markReadMutation.mutate({ senderId: activeChatFriend.id, receiverId: user.id });
        }
      }
      // Refresh chat list
      utils.message.chatList.invalidate();
    };

    const handleSent = (msg: ChatMessage) => {
      setChatMessages(prev => [...prev, msg]);
      utils.message.chatList.invalidate();
    };

    const handleTyping = (data: { senderId: number; isTyping: boolean }) => {
      setTypingUsers(prev => {
        const next = new Set(prev);
        if (data.isTyping) next.add(data.senderId);
        else next.delete(data.senderId);
        return next;
      });
    };

    const handleStatusChange = (data: { userId: number; isOnline: boolean }) => {
      setOnlineFriends(prev => {
        const next = new Set(prev);
        if (data.isOnline) next.add(data.userId);
        else next.delete(data.userId);
        return next;
      });
    };

    const handleNewRequest = () => {
      toast.info("收到新的好友请求");
      utils.friend.pendingRequests.invalidate();
    };

    const handleRequestAccepted = (fromUser: { nickname: string }) => {
      toast.success(`${fromUser.nickname} 接受了你的好友请求`);
      utils.friend.list.invalidate();
    };

    socket.on("message:receive", handleReceive);
    socket.on("message:sent", handleSent);
    socket.on("typing:indicator", handleTyping);
    socket.on("user:statusChange", handleStatusChange);
    socket.on("friend:newRequest", handleNewRequest);
    socket.on("friend:requestAccepted", handleRequestAccepted);

    return () => {
      socket.off("message:receive", handleReceive);
      socket.off("message:sent", handleSent);
      socket.off("typing:indicator", handleTyping);
      socket.off("user:statusChange", handleStatusChange);
      socket.off("friend:newRequest", handleNewRequest);
      socket.off("friend:requestAccepted", handleRequestAccepted);
    };
  }, [socket, activeChatFriend, user]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Add friend mutation
  const addFriendMutation = trpc.friend.addFriend.useMutation();
  const respondMutation = trpc.friend.respond.useMutation();

  const handleAddFriend = async () => {
    if (!addFriendId.trim() || !user) return;
    try {
      const result = await addFriendMutation.mutateAsync({
        requesterId: user.id,
        addresseeUniqueId: addFriendId.trim(),
      });
      if (result.success) {
        toast.success(result.message);
        setAddFriendId("");
        setShowAddFriend(false);
        // Notify target via socket
        const targetUser = await utils.chatUser.search.fetch({ uniqueId: addFriendId.trim() });
        if (targetUser && socket) {
          socket.emit("friend:request", {
            targetUserId: targetUser.id,
            fromUser: { id: user.id, nickname: user.nickname, uniqueId: user.uniqueId },
          });
        }
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error("添加失败，请重试");
    }
  };

  const handleRespondRequest = async (friendshipId: number, accept: boolean) => {
    if (!user) return;
    try {
      const result = await respondMutation.mutateAsync({ friendshipId, userId: user.id, accept });
      if (result.success) {
        toast.success(result.message);
        utils.friend.pendingRequests.invalidate();
        utils.friend.list.invalidate();
      }
    } catch {
      toast.error("操作失败");
    }
  };

  const openChat = (friend: ChatUserInfo) => {
    setActiveChatFriend(friend);
    setMobileSidebarOpen(false);
    setChatMessages([]);
    utils.message.getHistory.invalidate();
  };

  const sendMessage = () => {
    if (!messageInput.trim() || !socket || !connected || !user || !activeChatFriend) return;
    socket.emit("message:send", {
      senderId: user.id,
      receiverId: activeChatFriend.id,
      content: messageInput.trim(),
      type: "text",
    });
    setMessageInput("");
    setShowEmojiPicker(false);
    // Stop typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit("typing:stop", { senderId: user.id, receiverId: activeChatFriend.id });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
    // Typing indicator
    if (socket && user && activeChatFriend) {
      socket.emit("typing:start", { senderId: user.id, receiverId: activeChatFriend.id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing:stop", { senderId: user.id, receiverId: activeChatFriend.id });
      }, 2000);
    }
  };

  // Image upload
  const uploadImageMutation = trpc.message.uploadImage.useMutation();

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket || !connected || !user || !activeChatFriend) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片不能超过5MB");
      return;
    }

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const result = await uploadImageMutation.mutateAsync({
          fileName: file.name,
          base64Data: base64,
          contentType: file.type,
        });
        if (result.success && result.url) {
          socket.emit("message:send", {
            senderId: user.id,
            receiverId: activeChatFriend.id,
            content: result.url,
            type: "image",
          });
        }
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("图片上传失败");
      setUploadingImage(false);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Send location
  const handleSendLocation = () => {
    if (!socket || !connected || !user || !activeChatFriend) return;
    if (!navigator.geolocation) {
      toast.error("您的浏览器不支持定位功能");
      return;
    }

    setSendingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const locationData = JSON.stringify({ lat: latitude, lng: longitude });
        socket.emit("message:send", {
          senderId: user.id,
          receiverId: activeChatFriend.id,
          content: locationData,
          type: "location",
        });
        setSendingLocation(false);
        toast.success("位置已发送");
      },
      (error) => {
        setSendingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("请允许浏览器获取位置信息");
        } else {
          toast.error("获取位置失败，请重试");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleLogout = () => {
    logoutUser();
    navigate("/");
  };

  // Filter friends by search
  const filteredFriends = friends.filter(f =>
    !searchQuery || f.nickname.toLowerCase().includes(searchQuery.toLowerCase()) || f.uniqueId.includes(searchQuery.toUpperCase())
  );

  // Chat list with last messages
  const sortedChatList = useMemo(() => {
    return friends.map(friend => {
      const chatInfo = chatList.find(c => c.friendId === friend.id);
      return {
        friend,
        lastMessage: chatInfo?.lastMessage || null,
        unreadCount: chatInfo?.unreadCount || 0,
      };
    }).sort((a, b) => {
      const aTime = a.lastMessage?.sentAt || 0;
      const bTime = b.lastMessage?.sentAt || 0;
      return bTime - aTime;
    });
  }, [friends, chatList]);

  if (!user) return null;

  const showSidebar = isMobile ? mobileSidebarOpen : true;
  const showChatArea = isMobile ? !mobileSidebarOpen : true;

  return (
    <div className="h-screen flex bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      {showSidebar && (
        <div className={`${isMobile ? "w-full" : "w-80"} bg-white border-r flex flex-col shrink-0`}>
          {/* User header */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-green-100 shrink-0">
                {user.avatar && <img src={user.avatar} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{user.nickname}</p>
                <p className="text-xs text-muted-foreground">ID: {user.uniqueId}</p>
              </div>
              <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-gray-300"}`} />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("chats")}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                activeTab === "chats" ? "border-green-600 text-green-600" : "border-transparent text-muted-foreground"
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              聊天
            </button>
            <button
              onClick={() => setActiveTab("friends")}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors relative ${
                activeTab === "friends" ? "border-green-600 text-green-600" : "border-transparent text-muted-foreground"
              }`}
            >
              <Users className="w-4 h-4" />
              好友
              {pendingRequests.length > 0 && (
                <span className="absolute top-2 right-4 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                activeTab === "settings" ? "border-green-600 text-green-600" : "border-transparent text-muted-foreground"
              }`}
            >
              <Settings className="w-4 h-4" />
              设置
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "chats" && (
              <div className="h-full flex flex-col">
                <div className="p-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="搜索好友"
                      className="pl-9 rounded-xl h-9 text-sm"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  {sortedChatList.length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-sm">
                      <MessageCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p>还没有聊天记录</p>
                      <p className="text-xs mt-1">添加好友开始聊天吧</p>
                    </div>
                  ) : (
                    sortedChatList.filter(item =>
                      !searchQuery || item.friend.nickname.toLowerCase().includes(searchQuery.toLowerCase())
                    ).map(({ friend, lastMessage, unreadCount }) => (
                      <button
                        key={friend.id}
                        onClick={() => openChat(friend)}
                        className={`w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                          activeChatFriend?.id === friend.id ? "bg-green-50" : ""
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div className="w-11 h-11 rounded-full overflow-hidden bg-green-100">
                            {friend.avatar && <img src={friend.avatar} alt="" className="w-full h-full object-cover" />}
                          </div>
                          {onlineFriends.has(friend.id) && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm truncate">{friend.nickname}</span>
                            {lastMessage && (
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {new Date(lastMessage.sentAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-xs text-muted-foreground truncate">
                              {lastMessage ? lastMessage.content : "开始聊天吧"}
                            </span>
                            {unreadCount > 0 && (
                              <span className="w-5 h-5 bg-green-600 text-white text-[10px] rounded-full flex items-center justify-center shrink-0">
                                {unreadCount > 99 ? "99+" : unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </ScrollArea>
              </div>
            )}

            {activeTab === "friends" && (
              <div className="h-full flex flex-col">
                <div className="p-3">
                  <Button
                    onClick={() => setShowAddFriend(true)}
                    className="w-full bg-green-600 hover:bg-green-700 rounded-xl h-9 text-sm"
                  >
                    <UserPlus className="w-4 h-4 mr-1.5" />
                    添加好友
                  </Button>
                </div>

                <ScrollArea className="flex-1">
                  {/* Pending requests */}
                  {pendingRequests.length > 0 && (
                    <div className="px-3 pb-2">
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Bell className="w-3 h-3" />
                        待处理请求 ({pendingRequests.length})
                      </p>
                      {pendingRequests.map((req: any) => (
                        <div key={req.id} className="flex items-center gap-2 p-2 bg-yellow-50 rounded-xl mb-2">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-green-100 shrink-0">
                            {req.requester?.avatar && <img src={req.requester.avatar} alt="" className="w-full h-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{req.requester?.nickname || "未知"}</p>
                            <p className="text-[10px] text-muted-foreground">ID: {req.requester?.uniqueId}</p>
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => handleRespondRequest(req.id, true)}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleRespondRequest(req.id, false)}>
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Friend list */}
                  <div className="px-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      我的好友 ({friends.length})
                    </p>
                    {friends.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p>还没有好友</p>
                        <p className="text-xs mt-1">通过ID添加好友吧</p>
                      </div>
                    ) : (
                      filteredFriends.map(friend => (
                        <button
                          key={friend.id}
                          onClick={() => openChat(friend)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-green-100">
                              {friend.avatar && <img src={friend.avatar} alt="" className="w-full h-full object-cover" />}
                            </div>
                            {onlineFriends.has(friend.id) && (
                              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <p className="text-sm font-medium truncate">{friend.nickname}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {onlineFriends.has(friend.id) ? "在线" : "离线"}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="p-4 space-y-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-green-100">
                      {user.avatar && <img src={user.avatar} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div>
                      <p className="font-medium">{user.nickname}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-muted-foreground">ID: {user.uniqueId}</span>
                        <button onClick={() => {
                          navigator.clipboard.writeText(user.uniqueId);
                          toast.success("ID已复制");
                        }}>
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    将此ID分享给朋友，他们可以通过ID添加你为好友。换设备时使用此ID登录即可恢复所有数据。
                  </p>
                </Card>

                <Button
                  variant="outline"
                  onClick={() => navigate("/profile")}
                  className="w-full justify-start rounded-xl h-11"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  编辑个人资料
                </Button>

                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full justify-start rounded-xl h-11 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  退出登录
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat area */}
      {showChatArea && (
        <div className="flex-1 flex flex-col bg-white min-w-0">
          {activeChatFriend ? (
            <>
              {/* Chat header */}
              <div className="h-14 border-b flex items-center px-4 shrink-0">
                {isMobile && (
                  <Button variant="ghost" size="icon" className="mr-2 h-8 w-8" onClick={() => setMobileSidebarOpen(true)}>
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                )}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-green-100">
                      {activeChatFriend.avatar && <img src={activeChatFriend.avatar} alt="" className="w-full h-full object-cover" />}
                    </div>
                    {onlineFriends.has(activeChatFriend.id) && (
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{activeChatFriend.nickname}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {typingUsers.has(activeChatFriend.id) ? "正在输入..." : onlineFriends.has(activeChatFriend.id) ? "在线" : "离线"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {chatMessages.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                    <p>开始和 {activeChatFriend.nickname} 聊天吧</p>
                  </div>
                )}
                {chatMessages.map((msg) => {
                  const isMine = msg.senderId === user.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] ${isMine ? "order-1" : ""}`}>
                        <div className={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                          isMine
                            ? "bg-green-600 text-white rounded-br-md"
                            : "bg-white border rounded-bl-md shadow-sm"
                        }`}>
                          {msg.type === "image" ? (
                            <img
                              src={msg.content}
                              alt="图片"
                              className="max-w-[220px] rounded-lg cursor-pointer"
                              onClick={() => window.open(msg.content, "_blank")}
                            />
                          ) : msg.type === "location" ? (
                            <LocationBubble content={msg.content} isMine={isMine} />
                          ) : (
                            msg.content
                          )}
                        </div>
                        <p className={`text-[10px] text-muted-foreground mt-1 ${isMine ? "text-right" : ""}`}>
                          {new Date(msg.sentAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <div className="border-t bg-white p-3 shrink-0">
                {showEmojiPicker && (
                  <div className="mb-3 p-3 bg-gray-50 rounded-xl">
                    <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
                      {emojiCategories.map((cat, idx) => (
                        <button
                          key={cat.name}
                          onClick={() => setEmojiTab(idx)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                            emojiTab === idx ? "bg-green-600 text-white" : "text-muted-foreground hover:bg-gray-200"
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-10 gap-1 max-h-32 overflow-y-auto">
                      {emojiCategories[emojiTab].emojis.map((emoji, i) => (
                        <button
                          key={i}
                          onClick={() => setMessageInput(prev => prev + emoji)}
                          className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-200 rounded transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                      {showEmojiPicker ? <X className="w-5 h-5 text-muted-foreground" /> : <Smile className="w-5 h-5 text-muted-foreground" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      onClick={handleSendLocation}
                      disabled={sendingLocation}
                    >
                      {sendingLocation ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : <MapPin className="w-5 h-5 text-muted-foreground" />}
                    </Button>
                  </div>
                  <textarea
                    ref={inputRef}
                    value={messageInput}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder="输入消息..."
                    className="flex-1 resize-none rounded-xl border bg-gray-50 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 min-h-[42px] max-h-32"
                    rows={1}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!messageInput.trim() || !connected}
                    size="icon"
                    className="shrink-0 h-10 w-10 rounded-xl bg-green-600 hover:bg-green-700"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              {isMobile ? null : (
                <div className="text-center text-muted-foreground">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                  <p className="text-lg font-medium">选择一个好友开始聊天</p>
                  <p className="text-sm mt-1">或添加新好友</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add friend dialog */}
      <Dialog open={showAddFriend} onOpenChange={setShowAddFriend}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加好友</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">输入对方的ID</label>
              <Input
                value={addFriendId}
                onChange={(e) => setAddFriendId(e.target.value.toUpperCase())}
                placeholder="例如: A3B7K9"
                className="text-center font-mono text-lg tracking-widest"
              />
            </div>
            <div className="bg-green-50 p-3 rounded-xl">
              <p className="text-xs text-muted-foreground">
                <strong>你的ID: </strong>
                <span className="font-mono font-bold text-green-700">{user?.uniqueId}</span>
                <button onClick={() => { navigator.clipboard.writeText(user?.uniqueId || ""); toast.success("已复制"); }} className="ml-1.5 inline-flex">
                  <Copy className="w-3 h-3" />
                </button>
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">分享你的ID给朋友，让他们添加你</p>
            </div>
            <Button
              onClick={handleAddFriend}
              disabled={!addFriendId.trim() || addFriendMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700 rounded-xl"
            >
              {addFriendMutation.isPending ? "发送中..." : "发送好友请求"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
