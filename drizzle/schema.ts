import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, bigint, boolean, index } from "drizzle-orm/mysql-core";

/**
 * 匿名聊天用户表 - 通过生成的唯一ID登录，无需OAuth
 */
export const chatUsers = mysqlTable("chat_users", {
  id: int("id").autoincrement().primaryKey(),
  /** 用户唯一登录ID，6位字母数字组合 */
  uniqueId: varchar("uniqueId", { length: 16 }).notNull().unique(),
  nickname: varchar("nickname", { length: 50 }).notNull(),
  avatar: text("avatar"),
  avatarStyle: varchar("avatarStyle", { length: 32 }).default("adventurer"),
  /** 用户状态: active正常, banned封禁 */
  status: mysqlEnum("status", ["active", "banned"]).default("active").notNull(),
  /** 最后在线时间 */
  lastOnline: timestamp("lastOnline").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_uniqueId").on(table.uniqueId),
]);

export type ChatUser = typeof chatUsers.$inferSelect;
export type InsertChatUser = typeof chatUsers.$inferInsert;

/**
 * 好友关系表
 */
export const friendships = mysqlTable("friendships", {
  id: int("id").autoincrement().primaryKey(),
  /** 发起好友请求的用户ID */
  requesterId: int("requesterId").notNull(),
  /** 接收好友请求的用户ID */
  addresseeId: int("addresseeId").notNull(),
  /** 好友状态: pending待确认, accepted已接受, rejected已拒绝 */
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_requester").on(table.requesterId),
  index("idx_addressee").on(table.addresseeId),
]);

export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = typeof friendships.$inferInsert;

/**
 * 聊天消息表
 */
export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  /** 发送者用户ID */
  senderId: int("senderId").notNull(),
  /** 接收者用户ID */
  receiverId: int("receiverId").notNull(),
  /** 消息内容 */
  content: text("content").notNull(),
  /** 消息类型: text文本, image图片, location定位, system系统消息 */
  type: mysqlEnum("type", ["text", "image", "location", "system"]).default("text").notNull(),
  /** 是否已读 */
  isRead: boolean("isRead").default(false).notNull(),
  /** 发送时间戳(ms) */
  sentAt: bigint("sentAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_sender").on(table.senderId),
  index("idx_receiver").on(table.receiverId),
  index("idx_sentAt").on(table.sentAt),
]);

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

/**
 * 访问令牌表 - 管理员生成带时效的访问链接
 */
export const accessTokens = mysqlTable("access_tokens", {
  id: int("id").autoincrement().primaryKey(),
  /** 令牌字符串，用于URL参数 */
  token: varchar("token", { length: 64 }).notNull().unique(),
  /** 有效期（小时数） */
  expiresInHours: int("expiresInHours").notNull(),
  /** 过期时间 */
  expiresAt: timestamp("expiresAt").notNull(),
  /** 令牌状态: active有效, expired过期, revoked已作废 */
  status: mysqlEnum("status", ["active", "expired", "revoked"]).default("active").notNull(),
  /** 备注 */
  note: varchar("note", { length: 200 }),
  /** 创建者（管理员）ID */
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_token").on(table.token),
  index("idx_expiresAt").on(table.expiresAt),
]);

export type AccessToken = typeof accessTokens.$inferSelect;
export type InsertAccessToken = typeof accessTokens.$inferInsert;

/**
 * 管理员账号表 - 使用账号密码登录
 */
export const adminAccounts = mysqlTable("admin_accounts", {
  id: int("id").autoincrement().primaryKey(),
  /** 登录用户名 */
  username: varchar("username", { length: 64 }).notNull().unique(),
  /** bcrypt加密的密码 */
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  /** 显示名称 */
  displayName: varchar("displayName", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
});

export type AdminAccount = typeof adminAccounts.$inferSelect;
export type InsertAdminAccount = typeof adminAccounts.$inferInsert;

/**
 * 管理员表 - 保留用于OAuth兼容（系统内部使用）
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("admin").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
