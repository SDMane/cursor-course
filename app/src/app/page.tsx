"use client";
import React, { useState, useEffect, useRef } from "react";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'image';
  imageUrl?: string;
}

type ChatMode = 'text' | 'image';

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Hello! I can help you with text chat or generate images. Use the toggle below to switch between modes.', type: 'text' }
  ]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>('text');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      type: mode
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: mode === 'text' 
          ? `I received your message: "${userMessage.content}". This is a mock response for ${mode} mode.`
          : `I'll generate an image based on: "${userMessage.content}". This is a mock response for ${mode} mode.`,
        type: mode
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  if (messages.length === 1) {
    return (
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-3">
            <h1 className="text-xl font-semibold text-card-foreground">Chat Assistant</h1>
          </div>
        </div>

        {/* Main Content - Centered */}
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="text-center max-w-2xl w-full">
            <h2 className="text-3xl font-semibold text-foreground mb-8">
              What can I help with?
            </h2>
            
            {/* Unified Input Container */}
            <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
              {/* Input Field */}
              <div className="mb-4">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Message..."
                  className="w-full px-4 py-3 text-foreground bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmit(e)}
                />
              </div>
              
              {/* Toggle Buttons - Left aligned inside the same container */}
              <div className="flex space-x-2">
                <button
                  onClick={() => setMode('text')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    mode === 'text'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Text Chat
                </button>
                <button
                  onClick={() => setMode('image')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    mode === 'image'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Image Generation
                </button>
              </div>
            </div>

            {/* Send Button */}
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-xl font-semibold text-card-foreground">Chat Assistant</h1>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.slice(1).map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {message.type === 'image' && message.role === 'assistant' ? (
                <div className="text-center">
                  <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center mb-2">
                    <span className="text-muted-foreground">Generated Image Placeholder</span>
                  </div>
                  <p className="text-sm">{message.content}</p>
                </div>
              ) : (
                <p>{message.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted text-foreground px-4 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-foreground"></div>
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Unified Container */}
      <div className="border-t border-border bg-card p-4">
        <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
          {/* Input Field */}
          <div className="mb-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message..."
              className="w-full px-4 py-3 text-foreground bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit(e)}
            />
          </div>
          
          {/* Toggle Buttons - Left aligned inside the same container */}
          <div className="flex space-x-2 mb-4">
            <button
              onClick={() => setMode('text')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'text'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Text Chat
            </button>
            <button
              onClick={() => setMode('image')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'image'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Image Generation
            </button>
          </div>

          {/* Send Button */}
          <div className="text-center">
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
