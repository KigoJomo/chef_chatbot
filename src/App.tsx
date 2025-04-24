import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { useState } from "react";
import { Toaster } from "sonner";
import { Id } from "../convex/_generated/dataModel";

export default function App() {
  const [selectedChat, setSelectedChat] = useState<Id<"chats"> | null>(null);
  
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm p-4 flex justify-between items-center border-b">
        <h2 className="text-xl font-semibold accent-text">AI Chat</h2>
        <SignOutButton />
      </header>
      
      <main className="flex-1 flex">
        <ChatSidebar selectedChat={selectedChat} onSelectChat={setSelectedChat} />
        <ChatArea selectedChat={selectedChat} />
      </main>
      
      <Toaster />
    </div>
  );
}

function ChatSidebar({ selectedChat, onSelectChat }: { 
  selectedChat: Id<"chats"> | null, 
  onSelectChat: (id: Id<"chats"> | null) => void 
}) {
  const chats = useQuery(api.chat.listChats) || [];
  const createChat = useMutation(api.chat.createChat);
  
  const startNewChat = async (isGuest = false) => {
    const id = await createChat({ 
      title: "New Chat",
      isGuest 
    });
    onSelectChat(id);
  };

  return (
    <div className="w-64 border-r p-4 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <button 
          onClick={() => startNewChat()} 
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          New Chat
        </button>
        <button 
          onClick={() => startNewChat(true)}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Guest Chat
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        {chats.map(chat => (
          <div 
            key={chat._id}
            onClick={() => onSelectChat(chat._id)}
            className={`p-2 cursor-pointer rounded ${
              selectedChat === chat._id ? 'bg-blue-100' : 'hover:bg-gray-100'
            }`}
          >
            {chat.title}
            {chat.isGuest && <span className="ml-2 text-xs text-gray-500">(Guest)</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatArea({ selectedChat }: { selectedChat: Id<"chats"> | null }) {
  const messages = useQuery(api.chat.getChatMessages, 
    selectedChat ? { chatId: selectedChat } : "skip"
  ) || [];
  const sendMessage = useMutation(api.chat.sendMessage);
  const editMessage = useMutation(api.chat.editMessage);
  const [input, setInput] = useState("");
  const [editingId, setEditingId] = useState<Id<"messages"> | null>(null);
  
  if (!selectedChat) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select or create a chat to begin
      </div>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (editingId) {
      await editMessage({
        messageId: editingId,
        content: input
      });
      setEditingId(null);
    } else {
      await sendMessage({
        chatId: selectedChat,
        content: input
      });
    }
    setInput("");
  };

  const startEditing = (message: any) => {
    if (message.role === "user") {
      setEditingId(message._id);
      setInput(message.content);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 max-h-screen">
      <div className="flex-1 overflow-y-auto space-y-4">
        {messages.map(message => (
          <div 
            key={message._id}
            className={`p-4 rounded-lg max-w-2xl ${
              message.role === "assistant" 
                ? "bg-blue-100 ml-auto" 
                : "bg-gray-100"
            }`}
            onClick={() => startEditing(message)}
          >
            <div className="text-sm text-gray-500 mb-1">
              {message.role === "assistant" ? "AI" : "You"}
              {message.edited && <span className="ml-2">(edited)</span>}
            </div>
            {message.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={editingId ? "Edit message..." : "Type a message..."}
          className="flex-1 p-2 border rounded"
        />
        <button 
          type="submit"
          disabled={!input.trim()}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {editingId ? "Save" : "Send"}
        </button>
        {editingId && (
          <button
            onClick={() => {
              setEditingId(null);
              setInput("");
            }}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}
