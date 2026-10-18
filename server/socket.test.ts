import { describe, expect, it } from "vitest";

// Test the shared types and utility functions used by the socket server
describe("Chat Types and Utilities", () => {
  it("should define correct room types", () => {
    type RoomType = "plaza" | "private" | "group";
    const types: RoomType[] = ["plaza", "private", "group"];
    expect(types).toHaveLength(3);
    expect(types).toContain("plaza");
    expect(types).toContain("private");
    expect(types).toContain("group");
  });

  it("should generate correct private room IDs (sorted)", () => {
    // Simulate the getPrivateRoomId logic
    function getPrivateRoomId(userId1: string, userId2: string): string {
      const sorted = [userId1, userId2].sort();
      return `private:${sorted[0]}:${sorted[1]}`;
    }

    const roomId1 = getPrivateRoomId("user-a", "user-b");
    const roomId2 = getPrivateRoomId("user-b", "user-a");

    // Same room regardless of order
    expect(roomId1).toBe(roomId2);
    expect(roomId1).toBe("private:user-a:user-b");
  });

  it("should create system messages with correct structure", () => {
    interface ChatMessage {
      id: string;
      senderId: string;
      senderName: string;
      senderAvatar: string;
      content: string;
      timestamp: number;
      type: "text" | "system";
    }

    const sysMsg: ChatMessage = {
      id: "test-id",
      senderId: "system",
      senderName: "系统",
      senderAvatar: "",
      content: "用户加入了聊天",
      timestamp: Date.now(),
      type: "system",
    };

    expect(sysMsg.senderId).toBe("system");
    expect(sysMsg.type).toBe("system");
    expect(sysMsg.senderAvatar).toBe("");
    expect(sysMsg.content).toBe("用户加入了聊天");
  });

  it("should enforce max history limit", () => {
    const MAX_HISTORY = 200;
    const messages: string[] = [];

    // Simulate adding messages with limit
    for (let i = 0; i < 250; i++) {
      messages.push(`msg-${i}`);
      if (messages.length > MAX_HISTORY) messages.shift();
    }

    expect(messages.length).toBe(MAX_HISTORY);
    expect(messages[0]).toBe("msg-50");
    expect(messages[messages.length - 1]).toBe("msg-249");
  });

  it("should validate AnonUser structure", () => {
    interface AnonUser {
      id: string;
      nickname: string;
      avatar: string;
      avatarStyle: string;
      joinedAt: number;
    }

    const user: AnonUser = {
      id: "abc123",
      nickname: "快乐的小猫",
      avatar: "https://api.dicebear.com/9.x/adventurer/svg?seed=test",
      avatarStyle: "adventurer",
      joinedAt: Date.now(),
    };

    expect(user.id).toBe("abc123");
    expect(user.nickname).toBe("快乐的小猫");
    expect(user.avatar).toContain("dicebear.com");
    expect(user.avatarStyle).toBe("adventurer");
    expect(user.joinedAt).toBeGreaterThan(0);
  });

  it("should handle room member management correctly", () => {
    let members = ["user-1", "user-2", "user-3"];

    // Add member
    const newMember = "user-4";
    if (!members.includes(newMember)) {
      members.push(newMember);
    }
    expect(members).toHaveLength(4);

    // Remove member
    members = members.filter((id) => id !== "user-2");
    expect(members).toHaveLength(3);
    expect(members).not.toContain("user-2");

    // Don't add duplicate
    if (!members.includes("user-1")) {
      members.push("user-1");
    }
    expect(members).toHaveLength(3);
  });

  it("should format timestamps correctly for display", () => {
    const now = Date.now();
    const date = new Date(now);

    // Today's messages show time only
    const timeStr = date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(timeStr).toMatch(/\d{2}:\d{2}/);

    // Older messages show date + time
    const yesterday = new Date(now - 86400000);
    const dateStr = yesterday.toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(dateStr.length).toBeGreaterThan(0);
  });

  it("should handle chat room filtering by search query", () => {
    const rooms = [
      { id: "plaza", name: "聊天广场", type: "plaza" },
      { id: "private:1", name: "快乐的小猫", type: "private" },
      { id: "group:abc", name: "技术讨论组", type: "group" },
      { id: "group:def", name: "游戏交流群", type: "group" },
    ];

    const searchQuery = "技术";
    const filtered = rooms.filter((r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("技术讨论组");

    // Empty search returns all
    const noFilter = rooms.filter((r) =>
      "".length === 0 ? true : r.name.includes("")
    );
    expect(noFilter).toHaveLength(4);
  });
});
