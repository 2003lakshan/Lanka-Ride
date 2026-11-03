"use client";

import { useState, useRef, useEffect } from "react";
import { Send, User as UserIcon, Car } from "lucide-react";
import { useRouter } from "next/navigation";

import { useSocket } from "@/components/providers/SocketProvider";

interface Message {
  sender: 'RIDER' | 'DRIVER';
  text: string;
  createdAt: string;
}

interface EnquiryChatProps {
  enquiryId: string;
  initialMessages: Message[];
  currentUserRole: 'RIDER' | 'DRIVER';
  otherPartyName: string;
}

export default function EnquiryChat({ enquiryId, initialMessages, currentUserRole, otherPartyName }: EnquiryChatProps) {
  const { socket, isConnected, subscribeToEnquiry, unsubscribeFromEnquiry, registerReconnectHandler } = useSocket();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const processedEventIds = useRef<Set<string>>(new Set());

  // Sync with initialMessages when updated from server props
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Subscribe to enquiry room
  useEffect(() => {
    subscribeToEnquiry(enquiryId);
    return () => {
      unsubscribeFromEnquiry(enquiryId);
    };
  }, [enquiryId, subscribeToEnquiry, unsubscribeFromEnquiry]);

  // Re-fetch on reconnect
  useEffect(() => {
    return registerReconnectHandler(() => {
      router.refresh();
    });
  }, [registerReconnectHandler, router]);

  // Realtime message listener
  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (data: any) => {
      if (data.enquiryId !== enquiryId) return;

      if (data.eventId) {
        if (processedEventIds.current.has(data.eventId)) return;
        processedEventIds.current.add(data.eventId);
      }

      const incoming = data.message;
      if (!incoming) return;

      setMessages((prev) => {
        // Prevent duplicate if already added
        const isDuplicate = prev.some(
          (m) =>
            m.sender === incoming.sender &&
            m.text === incoming.text &&
            Math.abs(new Date(m.createdAt).getTime() - new Date(incoming.createdAt).getTime()) < 2000
        );
        if (isDuplicate) return prev;
        return [...prev, incoming];
      });
    };

    socket.on("chat:message", handleChatMessage);
    return () => {
      socket.off("chat:message", handleChatMessage);
    };
  }, [socket, enquiryId]);

  // Smart polling fallback: only active when disconnected
  useEffect(() => {
    if (isConnected) return; // Realtime active; disable polling

    const interval = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(interval);
  }, [isConnected, router]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const sentText = newMessage.trim();

    try {
      const res = await fetch(`/api/enquiries/${enquiryId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sentText }),
      });

      if (res.ok) {
        const json = await res.json();
        const msgToAdd: Message = json.data || {
          sender: currentUserRole,
          text: sentText,
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => {
          const exists = prev.some(
            (m) =>
              m.sender === msgToAdd.sender &&
              m.text === msgToAdd.text &&
              Math.abs(new Date(m.createdAt).getTime() - new Date(msgToAdd.createdAt).getTime()) < 2000
          );
          if (exists) return prev;
          return [...prev, msgToAdd];
        });
        setNewMessage("");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send message.");
      }
    } catch (error) {
      console.error(error);
      alert("Error sending message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col h-[600px] overflow-hidden">
      
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
          {currentUserRole === 'RIDER' ? <Car size={20} /> : <UserIcon size={20} />}
        </div>
        <div>
          <div className="font-bold text-slate-900">{otherPartyName}</div>
          <div className="text-xs text-slate-500 font-medium">
            {currentUserRole === 'RIDER' ? 'Driver' : 'Rider'}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map((msg, i) => {
          const isMe = msg.sender === currentUserRole;
          return (
            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl p-4 ${isMe ? 'bg-blue-600 text-white rounded-br-sm shadow-md shadow-blue-600/20' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'}`}>
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                <div className={`text-[10px] mt-2 font-medium ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white flex gap-2">
        <input 
          type="text" 
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Type your message to request changes..."
          className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-slate-50"
        />
        <button 
          type="submit" 
          disabled={!newMessage.trim() || sending}
          className="bg-blue-600 text-white w-12 h-12 rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={18} className={sending ? 'opacity-50' : ''} />
        </button>
      </form>
    </div>
  );
}
