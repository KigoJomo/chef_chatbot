import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  chats: defineTable({
    userId: v.optional(v.id("users")),
    title: v.string(),
    isGuest: v.boolean(),
  }).index("by_user", ["userId"]),
  
  messages: defineTable({
    chatId: v.id("chats"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    edited: v.optional(v.boolean()),
    originalContent: v.optional(v.string())
  }).index("by_chat", ["chatId"])
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
