import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import OpenAI from "openai";

export const createChat = mutation({
  args: {
    title: v.string(),
    isGuest: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    return await ctx.db.insert("chats", {
      userId: userId ?? undefined,
      title: args.title,
      isGuest: args.isGuest ?? false
    });
  }
});

export const listChats = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    return await ctx.db
      .query("chats")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  }
});

export const getChat = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.chatId);
  }
});

export const getChatMessages = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
      .collect();
  }
});

export const sendMessage = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("messages", {
      chatId: args.chatId,
      role: "user",
      content: args.content
    });

    await ctx.scheduler.runAfter(0, api.chat.generateResponse, {
      chatId: args.chatId,
      messageId
    });

    return messageId;
  }
});

export const editMessage = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string()
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return;

    await ctx.db.patch(args.messageId, {
      content: args.content,
      edited: true,
      originalContent: message.originalContent ?? message.content
    });

    if (message.role === "user") {
      await ctx.scheduler.runAfter(0, api.chat.generateResponse, {
        chatId: message.chatId,
        messageId: args.messageId
      });
    }
  }
});

export const generateResponse = action({
  args: {
    chatId: v.id("chats"),
    messageId: v.id("messages")
  },
  handler: async (ctx, args) => {
    const messages = await ctx.runQuery(api.chat.getChatMessages, { 
      chatId: args.chatId 
    });

    let responseText = "";
    for await (const chunk of streamResponse(messages)) {
      responseText += chunk;
      await ctx.runMutation(api.chat.updateStreamingResponse, {
        chatId: args.chatId,
        content: responseText
      });
    }
  }
});

export const updateStreamingResponse = mutation({
  args: {
    chatId: v.id("chats"),
    content: v.string()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_chat", q => q.eq("chatId", args.chatId))
      .order("desc")
      .first();

    if (existing?.role === "assistant") {
      await ctx.db.patch(existing._id, { content: args.content });
    } else {
      await ctx.db.insert("messages", {
        chatId: args.chatId,
        role: "assistant",
        content: args.content
      });
    }
  }
});

async function* streamResponse(messages: any[]) {
  const prompt = messages.map(m => `${m.role}: ${m.content}`).join("\n");
  
  // Using the bundled OpenAI for demo purposes
  const openai = new OpenAI({
    baseURL: process.env.CONVEX_OPENAI_BASE_URL,
    apiKey: process.env.CONVEX_OPENAI_API_KEY,
  });

  const stream = await openai.chat.completions.create({
    model: "gpt-4.1-nano",
    messages: [{ role: "user", content: prompt }],
    stream: true,
  });

  for await (const chunk of stream) {
    if (chunk.choices[0]?.delta?.content) {
      yield chunk.choices[0].delta.content;
    }
  }
}
