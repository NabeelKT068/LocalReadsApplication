"use client";

import { useState, useEffect, useRef } from 'react';
import { fetchAPI } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

export default function ChatModal({ txId, onClose }: { txId: string, onClose: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load history
    fetchAPI(`/chat/${txId}/messages`).then(setMessages).catch(console.error);

    // Connect WebSocket
    const token = localStorage.getItem('token');
    if (token) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//localhost:8000/api/v1/chat/ws/${txId}?token=${token}`);
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, data]);
      };

      wsRef.current = ws;
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [txId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && wsRef.current) {
      wsRef.current.send(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm animate-fade-in flex flex-col justify-end sm:justify-center items-center sm:p-4">
      <div className="bg-white dark:bg-gray-900 w-full sm:w-[450px] h-[80vh] sm:h-[600px] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/10 dark:border-white/10 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
          <h3 className="font-bold text-lg">Transaction Chat</h3>
          <button onClick={onClose} className="opacity-60 hover:opacity-100">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.map((msg, idx) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-gray-100 dark:bg-gray-800 rounded-bl-sm'}`}>
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={sendMessage} className="p-4 border-t border-black/10 dark:border-white/10 bg-gray-50 dark:bg-gray-800/50 flex gap-2">
          <input 
            type="text"
            className="flex-1 px-4 py-2 rounded-full bg-white dark:bg-gray-900 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Type a message..."
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
          />
          <button 
            type="submit" 
            disabled={!inputValue.trim()}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </form>
      </div>
    </div>
  );
}
