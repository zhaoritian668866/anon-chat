import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";
import { TRPCError } from "@trpc/server";
import { storagePut } from "./storage";

const ADMIN_COOKIE = "admin_session";

// Helper: sign admin JWT
async function signAdminToken(adminId: number, username: string): Promise<string> {
  const secret = new TextEncoder().encode(ENV.cookieSecret);
  return new SignJWT({ adminId, username, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

// Helper: verify admin JWT from request
async function verifyAdminFromReq(req: any): Promise<{ adminId: number; username: string } | null> {
  try {
    const cookieHeader = req.headers.cookie || "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c: string) => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      })
    );
    const token = cookies[ADMIN_COOKIE];
    if (!token) return null;

    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (!payload.adminId || !payload.username) return null;
    return { adminId: payload.adminId as number, username: payload.username as string };
  } catch {
    return null;
  }
}

// Admin middleware procedure
const adminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const admin = await verifyAdminFromReq(ctx.req);
  if (!admin) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "请先登录管理后台" });
  }
  return next({ ctx: { ...ctx, admin } });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============ Admin Auth (username/password) ============
  adminAuth: router({
    /** Admin login with username/password */
    login: publicProcedure
      .input(z.object({ username: z.string().min(1), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const account = await db.verifyAdminLogin(input.username, input.password);
        if (!account) return { success: false, message: "用户名或密码错误" };

        const token = await signAdminToken(account.id, account.username);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(ADMIN_COOKIE, token, {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return { success: true, admin: { id: account.id, username: account.username, displayName: account.displayName } };
      }),

    /** Check admin session */
    me: publicProcedure.query(async ({ ctx }) => {
      const admin = await verifyAdminFromReq(ctx.req);
      if (!admin) return null;
      const account = await db.getAdminAccountById(admin.adminId);
      if (!account) return null;
      return { id: account.id, username: account.username, displayName: account.displayName };
    }),

    /** Admin logout */
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(ADMIN_COOKIE, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),

    /** Change admin password */
    changePassword: adminProcedure
      .input(z.object({ oldPassword: z.string().min(1), newPassword: z.string().min(6) }))
      .mutation(async ({ input, ctx }) => {
        const account = await db.getAdminAccountById((ctx as any).admin.adminId);
        if (!account) return { success: false, message: "账号不存在" };

        const valid = await db.verifyAdminLogin(account.username, input.oldPassword);
        if (!valid) return { success: false, message: "原密码错误" };

        await db.updateAdminPassword(account.id, input.newPassword);
        return { success: true, message: "密码修改成功" };
      }),
  }),

  // ============ Chat User (anonymous login system) ============
  chatUser: router({
    /** Register a new anonymous user */
    register: publicProcedure
      .input(z.object({
        nickname: z.string().min(1).max(50),
        avatar: z.string().optional(),
        avatarStyle: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const user = await db.createChatUser(input);
        if (!user) return { success: false, message: "注册失败，请重试" };
        return { success: true, user };
      }),

    /** Login with unique ID */
    login: publicProcedure
      .input(z.object({ uniqueId: z.string().min(1).max(16) }))
      .mutation(async ({ input }) => {
        const user = await db.getChatUserByUniqueId(input.uniqueId.toUpperCase());
        if (!user) return { success: false, message: "ID不存在，请检查后重试" };
        if (user.status === "banned") return { success: false, message: "该账号已被封禁" };
        await db.updateLastOnline(user.id);
        return { success: true, user };
      }),

    /** Update profile */
    updateProfile: publicProcedure
      .input(z.object({
        userId: z.number(),
        nickname: z.string().min(1).max(50).optional(),
        avatar: z.string().optional(),
        avatarStyle: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { userId, ...data } = input;
        const user = await db.updateChatUser(userId, data);
        return { success: !!user, user };
      }),

    /** Get user by ID */
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getChatUserById(input.id);
      }),

    /** Search user by unique ID */
    search: publicProcedure
      .input(z.object({ uniqueId: z.string() }))
      .query(async ({ input }) => {
        if (!input.uniqueId.trim()) return null;
        return db.searchChatUserByUniqueId(input.uniqueId);
      }),
  }),

  // ============ Friends ============
  friend: router({
    /** Send friend request */
    addFriend: publicProcedure
      .input(z.object({ requesterId: z.number(), addresseeUniqueId: z.string() }))
      .mutation(async ({ input }) => {
        const addressee = await db.getChatUserByUniqueId(input.addresseeUniqueId.toUpperCase());
        if (!addressee) return { success: false, message: "用户不存在" };
        return db.createFriendRequest(input.requesterId, addressee.id);
      }),

    /** Respond to friend request */
    respond: publicProcedure
      .input(z.object({ friendshipId: z.number(), userId: z.number(), accept: z.boolean() }))
      .mutation(async ({ input }) => {
        return db.respondFriendRequest(input.friendshipId, input.userId, input.accept);
      }),

    /** Get friend list */
    list: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getFriends(input.userId);
      }),

    /** Get pending friend requests */
    pendingRequests: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getPendingFriendRequests(input.userId);
      }),

    /** Remove friend */
    remove: publicProcedure
      .input(z.object({ userId: z.number(), friendId: z.number() }))
      .mutation(async ({ input }) => {
        return db.removeFriend(input.userId, input.friendId);
      }),
  }),

  // ============ Messages ============
  message: router({
    /** Get messages between two users */
    getHistory: publicProcedure
      .input(z.object({ userId1: z.number(), userId2: z.number(), page: z.number().default(1) }))
      .query(async ({ input }) => {
        return db.getMessagesBetweenUsers(input.userId1, input.userId2, input.page);
      }),

    /** Mark messages as read */
    markRead: publicProcedure
      .input(z.object({ senderId: z.number(), receiverId: z.number() }))
      .mutation(async ({ input }) => {
        await db.markMessagesAsRead(input.senderId, input.receiverId);
        return { success: true };
      }),

    /** Get unread count */
    unreadCount: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getUnreadCount(input.userId);
      }),

    /** Get last message for each friend (chat list) */
    chatList: publicProcedure
      .input(z.object({ userId: z.number(), friendIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        return db.getLastMessageForEachFriend(input.userId, input.friendIds);
      }),

    /** Upload image for chat */
    uploadImage: publicProcedure
      .input(z.object({
        fileName: z.string(),
        base64Data: z.string(),
        contentType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ input }) => {
        const buffer = Buffer.from(input.base64Data, "base64");
        const key = `chat-images/${Date.now()}-${input.fileName}`;
        const { url } = await storagePut(key, buffer, input.contentType);
        return { success: true, url };
      }),
  }),

  // ============ Access Tokens ============
  accessToken: router({
    /** Validate an access token (public) */
    validate: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        return db.validateAccessToken(input.token);
      }),

    /** Create access token (admin only) */
    create: adminProcedure
      .input(z.object({
        expiresInHours: z.number().min(1).max(720),
        note: z.string().max(200).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const token = await db.createAccessToken({
          expiresInHours: input.expiresInHours,
          note: input.note,
          createdBy: (ctx as any).admin.adminId,
        });
        return { success: !!token, token };
      }),

    /** List all access tokens (admin only) */
    list: adminProcedure
      .input(z.object({ page: z.number().default(1) }))
      .query(async ({ input }) => {
        return db.getAllAccessTokens(input.page);
      }),

    /** Revoke access token (admin only) */
    revoke: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return db.revokeAccessToken(input.id);
      }),
  }),

  // ============ Admin ============
  admin: router({
    /** Get all chat users (admin only) */
    users: adminProcedure
      .input(z.object({ page: z.number().default(1), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getAllChatUsers(input.page, input.limit);
      }),

    /** Get all messages (admin only) */
    messages: adminProcedure
      .input(z.object({ page: z.number().default(1), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getAllMessages(input.page, input.limit);
      }),

    /** Get messages by user (admin only) */
    messagesByUser: adminProcedure
      .input(z.object({ userId: z.number(), page: z.number().default(1), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getMessagesByUser(input.userId, input.page, input.limit);
      }),

    /** Ban/unban user (admin only) */
    setUserStatus: adminProcedure
      .input(z.object({ userId: z.number(), status: z.enum(["active", "banned"]) }))
      .mutation(async ({ input }) => {
        await db.setChatUserStatus(input.userId, input.status);
        return { success: true };
      }),

    /** Get user detail (admin only) */
    getUserDetail: adminProcedure
      .input(z.object({ userId: z.number() }))
      .query(async ({ input }) => {
        return db.getChatUserById(input.userId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
