import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

import { SignJWT } from "jose";

let adminToken: string | null = null;

async function getAdminToken() {
  if (adminToken) return adminToken;
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || "test-secret");
  adminToken = await new SignJWT({ adminId: 1, username: "admin", role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(secret);
  return adminToken;
}

function createAdminContext(): TrpcContext {
  // We need to provide a valid admin_session cookie for adminProcedure
  // But since we can't easily do async in context creation, we'll use a workaround
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

async function createAdminContextWithToken(): Promise<TrpcContext> {
  const token = await getAdminToken();
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {
        cookie: `admin_session=${token}`,
      },
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("chatUser router", () => {
  it("register creates a new user with unique ID", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.chatUser.register({
      nickname: "测试用户",
      avatar: "https://example.com/avatar.png",
      avatarStyle: "adventurer",
    });
    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    if (result.user) {
      expect(result.user.nickname).toBe("测试用户");
      expect(result.user.uniqueId).toHaveLength(6);
      expect(result.user.uniqueId).toMatch(/^[A-Z0-9]+$/);
    }
  });

  it("login with valid unique ID returns user", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    // First register
    const reg = await caller.chatUser.register({ nickname: "登录测试" });
    expect(reg.success).toBe(true);
    const uniqueId = reg.user?.uniqueId;
    expect(uniqueId).toBeDefined();

    // Then login
    const login = await caller.chatUser.login({ uniqueId: uniqueId! });
    expect(login.success).toBe(true);
    expect(login.user?.nickname).toBe("登录测试");
  });

  it("login with invalid ID returns error", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.chatUser.login({ uniqueId: "ZZZZZZ" });
    expect(result.success).toBe(false);
    expect(result.message).toContain("不存在");
  });

  it("updateProfile changes nickname", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const reg = await caller.chatUser.register({ nickname: "旧昵称" });
    expect(reg.success).toBe(true);

    const result = await caller.chatUser.updateProfile({
      userId: reg.user!.id,
      nickname: "新昵称",
    });
    expect(result.success).toBe(true);
    expect(result.user?.nickname).toBe("新昵称");
  });
});

describe("friend router", () => {
  it("can send and accept friend request", async () => {
    const caller = appRouter.createCaller(createPublicContext());

    // Create two users
    const user1 = await caller.chatUser.register({ nickname: "用户A" });
    const user2 = await caller.chatUser.register({ nickname: "用户B" });
    expect(user1.success && user2.success).toBe(true);

    // Send friend request
    const request = await caller.friend.addFriend({
      requesterId: user1.user!.id,
      addresseeUniqueId: user2.user!.uniqueId,
    });
    expect(request.success).toBe(true);

    // Check pending requests
    const pending = await caller.friend.pendingRequests({ userId: user2.user!.id });
    expect(pending.length).toBeGreaterThan(0);

    // Accept request
    const accept = await caller.friend.respond({
      friendshipId: pending[0].id,
      userId: user2.user!.id,
      accept: true,
    });
    expect(accept.success).toBe(true);

    // Check friend list
    const friends = await caller.friend.list({ userId: user1.user!.id });
    expect(friends.length).toBeGreaterThan(0);
    expect(friends.some(f => f.id === user2.user!.id)).toBe(true);
  });

  it("cannot add self as friend", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const user = await caller.chatUser.register({ nickname: "自己" });
    expect(user.success).toBe(true);

    const result = await caller.friend.addFriend({
      requesterId: user.user!.id,
      addresseeUniqueId: user.user!.uniqueId,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("自己");
  });
});

describe("admin router", () => {
  it("requires admin role for admin routes", async () => {
    const publicCaller = appRouter.createCaller(createPublicContext());
    await expect(publicCaller.admin.users({ page: 1, limit: 10 })).rejects.toThrow();
  });

  it("rejects non-admin authenticated users", async () => {
    const userContext: TrpcContext = {
      user: {
        id: 2,
        openId: "regular-user",
        email: "user@example.com",
        name: "Regular User",
        loginMethod: "manus",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: () => {} } as TrpcContext["res"],
    };
    const userCaller = appRouter.createCaller(userContext);
    await expect(userCaller.admin.users({ page: 1, limit: 10 })).rejects.toThrow();
  });

  it("admin can list users", async () => {
    const ctx = await createAdminContextWithToken();
    const adminCaller = appRouter.createCaller(ctx);
    const result = await adminCaller.admin.users({ page: 1, limit: 10 });
    expect(result).toHaveProperty("users");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.users)).toBe(true);
  });

  it("admin can list messages", async () => {
    const ctx = await createAdminContextWithToken();
    const adminCaller = appRouter.createCaller(ctx);
    const result = await adminCaller.admin.messages({ page: 1, limit: 10 });
    expect(result).toHaveProperty("messages");
    expect(result).toHaveProperty("total");
  });
});
