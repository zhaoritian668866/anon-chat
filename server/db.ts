import { eq, and, or, desc, asc, sql, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, chatUsers, friendships, messages, type ChatUser, type InsertChatUser, type InsertFriendship, type InsertMessage } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ Admin Users (OAuth) ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ Chat Users ============

/** 生成6位唯一ID */
function generateUniqueId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export async function createChatUser(data: { nickname: string; avatar?: string; avatarStyle?: string }): Promise<ChatUser | null> {
  const db = await getDb();
  if (!db) return null;

  // Try generating unique ID (retry up to 5 times)
  for (let i = 0; i < 5; i++) {
    const uniqueId = generateUniqueId();
    try {
      await db.insert(chatUsers).values({
        uniqueId,
        nickname: data.nickname,
        avatar: data.avatar || null,
        avatarStyle: data.avatarStyle || "adventurer",
      });
      const result = await db.select().from(chatUsers).where(eq(chatUsers.uniqueId, uniqueId)).limit(1);
      return result[0] || null;
    } catch (e: any) {
      if (e.code === "ER_DUP_ENTRY") continue;
      throw e;
    }
  }
  return null;
}

export async function getChatUserByUniqueId(uniqueId: string): Promise<ChatUser | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(chatUsers).where(eq(chatUsers.uniqueId, uniqueId)).limit(1);
  return result[0] || null;
}

export async function getChatUserById(id: number): Promise<ChatUser | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(chatUsers).where(eq(chatUsers.id, id)).limit(1);
  return result[0] || null;
}

export async function updateChatUser(id: number, data: { nickname?: string; avatar?: string; avatarStyle?: string }): Promise<ChatUser | null> {
  const db = await getDb();
  if (!db) return null;
  const updateSet: Record<string, unknown> = {};
  if (data.nickname) updateSet.nickname = data.nickname;
  if (data.avatar !== undefined) updateSet.avatar = data.avatar;
  if (data.avatarStyle) updateSet.avatarStyle = data.avatarStyle;
  if (Object.keys(updateSet).length === 0) return getChatUserById(id);
  await db.update(chatUsers).set(updateSet).where(eq(chatUsers.id, id));
  return getChatUserById(id);
}

export async function updateLastOnline(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(chatUsers).set({ lastOnline: new Date() }).where(eq(chatUsers.id, id));
}

export async function setChatUserStatus(id: number, status: "active" | "banned"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(chatUsers).set({ status }).where(eq(chatUsers.id, id));
}

export async function getAllChatUsers(page: number = 1, limit: number = 50) {
  const db = await getDb();
  if (!db) return { users: [], total: 0 };
  const offset = (page - 1) * limit;
  const result = await db.select().from(chatUsers).orderBy(desc(chatUsers.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(chatUsers);
  return { users: result, total: countResult[0]?.count || 0 };
}

export async function searchChatUserByUniqueId(uniqueId: string): Promise<ChatUser | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(chatUsers).where(eq(chatUsers.uniqueId, uniqueId.toUpperCase())).limit(1);
  return result[0] || null;
}

// ============ Friendships ============

export async function createFriendRequest(requesterId: number, addresseeId: number): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: "数据库不可用" };
  if (requesterId === addresseeId) return { success: false, message: "不能添加自己为好友" };

  // Check if friendship already exists
  const existing = await db.select().from(friendships).where(
    or(
      and(eq(friendships.requesterId, requesterId), eq(friendships.addresseeId, addresseeId)),
      and(eq(friendships.requesterId, addresseeId), eq(friendships.addresseeId, requesterId))
    )
  ).limit(1);

  if (existing.length > 0) {
    const f = existing[0];
    if (f.status === "accepted") return { success: false, message: "你们已经是好友了" };
    if (f.status === "pending") return { success: false, message: "好友请求已发送，等待对方确认" };
    if (f.status === "rejected") {
      // Allow re-request
      await db.update(friendships).set({ status: "pending", requesterId, addresseeId }).where(eq(friendships.id, f.id));
      return { success: true, message: "好友请求已重新发送" };
    }
  }

  await db.insert(friendships).values({ requesterId, addresseeId });
  return { success: true, message: "好友请求已发送" };
}

export async function respondFriendRequest(friendshipId: number, userId: number, accept: boolean): Promise<{ success: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { success: false, message: "数据库不可用" };

  const result = await db.select().from(friendships).where(eq(friendships.id, friendshipId)).limit(1);
  if (!result.length) return { success: false, message: "请求不存在" };

  const f = result[0];
  if (f.addresseeId !== userId) return { success: false, message: "无权操作" };
  if (f.status !== "pending") return { success: false, message: "请求已处理" };

  await db.update(friendships).set({ status: accept ? "accepted" : "rejected" }).where(eq(friendships.id, friendshipId));
  return { success: true, message: accept ? "已添加好友" : "已拒绝" };
}

export async function getFriends(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select().from(friendships).where(
    and(
      or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
      eq(friendships.status, "accepted")
    )
  );

  // Get friend user details
  const friendIds = result.map(f => f.requesterId === userId ? f.addresseeId : f.requesterId);
  if (friendIds.length === 0) return [];

  const friendUsers = await Promise.all(friendIds.map(id => getChatUserById(id)));
  return friendUsers.filter(Boolean) as ChatUser[];
}

export async function getPendingFriendRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select().from(friendships).where(
    and(eq(friendships.addresseeId, userId), eq(friendships.status, "pending"))
  ).orderBy(desc(friendships.createdAt));

  // Get requester details
  const requests = await Promise.all(result.map(async (f) => {
    const requester = await getChatUserById(f.requesterId);
    return { ...f, requester };
  }));

  return requests;
}

export async function removeFriend(userId: number, friendId: number): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) return { success: false };

  await db.delete(friendships).where(
    or(
      and(eq(friendships.requesterId, userId), eq(friendships.addresseeId, friendId)),
      and(eq(friendships.requesterId, friendId), eq(friendships.addresseeId, userId))
    )
  );
  return { success: true };
}

// ============ Messages ============

export async function saveMessage(data: { senderId: number; receiverId: number; content: string; type?: "text" | "image" | "location" | "system" }): Promise<InsertMessage & { id: number } | null> {
  const db = await getDb();
  if (!db) return null;

  const msg = {
    senderId: data.senderId,
    receiverId: data.receiverId,
    content: data.content,
    type: data.type || "text" as const,
    sentAt: Date.now(),
  };

  const result = await db.insert(messages).values(msg);
  const insertId = (result as any)[0]?.insertId;
  return { ...msg, id: insertId, isRead: false, createdAt: new Date() };
}

export async function getMessagesBetweenUsers(userId1: number, userId2: number, page: number = 1, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];

  const offset = (page - 1) * limit;
  const result = await db.select().from(messages).where(
    or(
      and(eq(messages.senderId, userId1), eq(messages.receiverId, userId2)),
      and(eq(messages.senderId, userId2), eq(messages.receiverId, userId1))
    )
  ).orderBy(desc(messages.sentAt)).limit(limit).offset(offset);

  return result.reverse();
}

export async function markMessagesAsRead(senderId: number, receiverId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(messages).set({ isRead: true }).where(
    and(eq(messages.senderId, senderId), eq(messages.receiverId, receiverId), eq(messages.isRead, false))
  );
}

export async function getUnreadCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(messages).where(
    and(eq(messages.receiverId, userId), eq(messages.isRead, false))
  );
  return result[0]?.count || 0;
}

export async function getLastMessageForEachFriend(userId: number, friendIds: number[]) {
  const db = await getDb();
  if (!db) return [];

  const results = await Promise.all(friendIds.map(async (friendId) => {
    const msg = await db.select().from(messages).where(
      or(
        and(eq(messages.senderId, userId), eq(messages.receiverId, friendId)),
        and(eq(messages.senderId, friendId), eq(messages.receiverId, userId))
      )
    ).orderBy(desc(messages.sentAt)).limit(1);

    const unread = await db.select({ count: sql<number>`count(*)` }).from(messages).where(
      and(eq(messages.senderId, friendId), eq(messages.receiverId, userId), eq(messages.isRead, false))
    );

    return {
      friendId,
      lastMessage: msg[0] || null,
      unreadCount: unread[0]?.count || 0,
    };
  }));

  return results;
}

// ============ Admin: All Messages ============

export async function getAllMessages(page: number = 1, limit: number = 50) {
  const db = await getDb();
  if (!db) return { messages: [], total: 0 };
  const offset = (page - 1) * limit;
  const result = await db.select().from(messages).orderBy(desc(messages.sentAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(messages);
  return { messages: result, total: countResult[0]?.count || 0 };
}

export async function getMessagesByUser(userId: number, page: number = 1, limit: number = 50) {
  const db = await getDb();
  if (!db) return { messages: [], total: 0 };
  const offset = (page - 1) * limit;
  const result = await db.select().from(messages).where(
    or(eq(messages.senderId, userId), eq(messages.receiverId, userId))
  ).orderBy(desc(messages.sentAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(messages).where(
    or(eq(messages.senderId, userId), eq(messages.receiverId, userId))
  );
  return { messages: result, total: countResult[0]?.count || 0 };
}

// ============ Access Tokens ============

import { accessTokens, type AccessToken } from "../drizzle/schema";
import { nanoid } from "nanoid";
import { lt } from "drizzle-orm";

export async function createAccessToken(data: { expiresInHours: number; note?: string; createdBy?: number }): Promise<AccessToken | null> {
  const db = await getDb();
  if (!db) return null;

  const token = nanoid(24);
  const expiresAt = new Date(Date.now() + data.expiresInHours * 60 * 60 * 1000);

  await db.insert(accessTokens).values({
    token,
    expiresInHours: data.expiresInHours,
    expiresAt,
    note: data.note || null,
    createdBy: data.createdBy || null,
  });

  const result = await db.select().from(accessTokens).where(eq(accessTokens.token, token)).limit(1);
  return result[0] || null;
}

export async function validateAccessToken(token: string): Promise<{ valid: boolean; message: string }> {
  const db = await getDb();
  if (!db) return { valid: false, message: "服务不可用" };

  const result = await db.select().from(accessTokens).where(eq(accessTokens.token, token)).limit(1);
  if (!result.length) return { valid: false, message: "链接无效" };

  const t = result[0];
  if (t.status === "revoked") return { valid: false, message: "链接已被作废" };
  if (t.status === "expired" || new Date() > t.expiresAt) {
    // Auto-update status if expired
    if (t.status !== "expired") {
      await db.update(accessTokens).set({ status: "expired" }).where(eq(accessTokens.id, t.id));
    }
    return { valid: false, message: "链接已过期" };
  }

  return { valid: true, message: "有效" };
}

export async function getAllAccessTokens(page: number = 1, limit: number = 50) {
  const db = await getDb();
  if (!db) return { tokens: [], total: 0 };

  // Auto-expire tokens
  await db.update(accessTokens).set({ status: "expired" }).where(
    and(eq(accessTokens.status, "active"), lt(accessTokens.expiresAt, new Date()))
  );

  const offset = (page - 1) * limit;
  const result = await db.select().from(accessTokens).orderBy(desc(accessTokens.createdAt)).limit(limit).offset(offset);
  const countResult = await db.select({ count: sql<number>`count(*)` }).from(accessTokens);
  return { tokens: result, total: countResult[0]?.count || 0 };
}

export async function revokeAccessToken(id: number): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) return { success: false };
  await db.update(accessTokens).set({ status: "revoked" }).where(eq(accessTokens.id, id));
  return { success: true };
}

// ============ Admin Accounts (username/password) ============

import { adminAccounts, type AdminAccount } from "../drizzle/schema";
import bcrypt from "bcryptjs";

export async function createAdminAccount(username: string, password: string, displayName?: string): Promise<AdminAccount | null> {
  const db = await getDb();
  if (!db) return null;

  const passwordHash = await bcrypt.hash(password, 12);
  await db.insert(adminAccounts).values({
    username,
    passwordHash,
    displayName: displayName || username,
  });

  const result = await db.select().from(adminAccounts).where(eq(adminAccounts.username, username)).limit(1);
  return result[0] || null;
}

export async function verifyAdminLogin(username: string, password: string): Promise<AdminAccount | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(adminAccounts).where(eq(adminAccounts.username, username)).limit(1);
  if (!result.length) return null;

  const account = result[0];
  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) return null;

  // Update last signed in
  await db.update(adminAccounts).set({ lastSignedIn: new Date() }).where(eq(adminAccounts.id, account.id));
  return account;
}

export async function getAdminAccountByUsername(username: string): Promise<AdminAccount | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(adminAccounts).where(eq(adminAccounts.username, username)).limit(1);
  return result[0] || null;
}

export async function getAdminAccountById(id: number): Promise<AdminAccount | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db.select().from(adminAccounts).where(eq(adminAccounts.id, id)).limit(1);
  return result[0] || null;
}

export async function updateAdminPassword(id: number, newPassword: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(adminAccounts).set({ passwordHash }).where(eq(adminAccounts.id, id));
  return true;
}

export async function ensureDefaultAdmin(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select().from(adminAccounts).limit(1);
  if (existing.length === 0) {
    // Create default admin account: admin / admin123
    await createAdminAccount("admin", "admin123", "管理员");
    console.log("[Admin] Default admin account created: admin / admin123");
  }
}
