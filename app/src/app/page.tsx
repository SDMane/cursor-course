"use client";
import React, { useState, useEffect, useRef } from "react";

// Security constants
const MAX_MESSAGE_LENGTH = 1000;
const MAX_IMAGE_PROMPT_LENGTH = 4000; // DALL-E 3 limit

// Content sanitization function
const sanitizeImagePrompt = (prompt: string): string => {
  return prompt
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .substring(0, MAX_IMAGE_PROMPT_LENGTH)
    .trim();
};

// Error message sanitization
const sanitizeErrorMessage = (error: any): string => {
  const message = error?.message || 'An unknown error occurred';
  // Remove potentially sensitive information
  return message
    .replace(/Bearer [^\s]+/g, 'Bearer [REDACTED]')
    .replace(/api[_-]?key[=:][^\s&]+/gi, 'api_key=[REDACTED]')
    .substring(0, 200); // Limit error message length
};

// Simple image component without complex state management
function ImageWithFallback({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <img 
      src={src} 
      alt={alt}
      className={className}
      onError={(e) => {
        // Simple fallback - replace with a placeholder
        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2IiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjEyOCIgeT0iMTI4IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2QjcyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5GYWlsZWQgdG8gbG9hZCBpbWFnZTwvdGV4dD4KPC9zdmc+';
      }}
    />
  );
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'image';
  imageUrl?: string;
  prompt?: string;
}

type ChatMode = 'text' | 'image';

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Hello! I can help you with text chat or generate images. Use the toggle below to switch between modes.', type: 'text' }
  ]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<ChatMode>('text');
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [rateLimited, setRateLimited] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null); // Add chat session ID
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Add new chat functionality
  const startNewChat = () => {
    setMessages([
      { id: '1', role: 'assistant', content: 'Hello! I can help you with text chat or generate images. Use the toggle below to switch between modes.', type: 'text' }
    ]);
    setChatId(null); // Reset chat ID to trigger new session creation
    setInput('');
    setValidationError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setValidationError('');
    
    // Enhanced validation
    if (!input.trim()) {
      setValidationError('Please enter a message');
      return;
    }
    
    if (isLoading || rateLimited) {
      return;
    }
    
    if (input.length > MAX_MESSAGE_LENGTH) {
      setValidationError(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
      return;
    }
    
    if (mode === 'image' && input.length > MAX_IMAGE_PROMPT_LENGTH) {
      setValidationError(`Image prompt too long (max ${MAX_IMAGE_PROMPT_LENGTH} characters)`);
      return;
    }

    // Sanitize input based on mode
    const sanitizedContent = mode === 'image' ? sanitizeImagePrompt(input) : input.trim();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: sanitizedContent,
      type: mode
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Generate chatId if it doesn't exist (will be used by API)
    const currentChatId = chatId || crypto.randomUUID();
    if (!chatId) {
      setChatId(currentChatId);
    }

    if (mode === 'text') {
      // Real streaming API call for text mode
      try {
        const response = await fetch('http://127.0.0.1:54321/functions/v1/chat-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
          },
          body: JSON.stringify({ 
            message: userMessage.content,
            chatId: currentChatId
          })
        });

        if (!response.ok) {
          if (response.status === 429) {
            setRateLimited(true);
            setValidationError('Too many requests. Please wait a moment.');
            setTimeout(() => setRateLimited(false), 60000); // 1 minute cooldown
            return;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Create assistant message that will be updated with streaming content
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '',
          type: 'text'
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Read the streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (reader) {
          let accumulatedContent = '';
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            console.log('Received chunk:', chunk);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                console.log('Processing data:', data);
                
                if (data === '[DONE]') {
                  console.log('Stream completed');
                  setIsLoading(false);
                  break;
                }
                
                if (data) {
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.content) {
                      console.log('Adding token:', parsed.content);
                      accumulatedContent += parsed.content;
                      
                      // Update the assistant message with accumulated content
                      setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessage.id 
                          ? { ...msg, content: accumulatedContent }
                          : msg
                      ));
                    }
                  } catch (e) {
                    console.log('Invalid JSON:', data);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error calling chat API:', error);
        const sanitizedError = sanitizeErrorMessage(error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          type: 'text'
        };
        setMessages(prev => [...prev, errorMessage]);
        setValidationError(sanitizedError);
        setIsLoading(false);
      }
    } else {
      // Real image generation API call
      try {
        const response = await fetch('http://127.0.0.1:54321/functions/v1/chat-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
          },
          body: JSON.stringify({ 
            message: userMessage.content,
            chatId: currentChatId
          })
        });

        const data = await response.json();
        console.log('Image generation response:', data);

        if (!response.ok) {
          if (response.status === 429) {
            setRateLimited(true);
            setValidationError('Too many requests. Please wait a moment.');
            setTimeout(() => setRateLimited(false), 60000); // 1 minute cooldown
            return;
          }
          // Handle API errors with user-friendly messages
          const errorMessage = data.error || `HTTP error! status: ${response.status}`;
          throw new Error(errorMessage);
        }

        if (data.success && data.imageUrl) {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.imageUrl, // Store the image URL in content
            type: 'image',
            prompt: data.revisedPrompt || userMessage.content // Store the prompt for display
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          throw new Error(data.error || 'Failed to generate image');
        }
      } catch (error) {
        console.error('Error calling image generation API:', error);
        const sanitizedError = sanitizeErrorMessage(error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error generating the image. Please try again.',
          type: 'text'
        };
        setMessages(prev => [...prev, errorMessage]);
        setValidationError(sanitizedError);
      }
      setIsLoading(false);
    }
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
                  onChange={(e) => {
                    setInput(e.target.value);
                    setValidationError(''); // Clear error on input change
                  }}
                  placeholder="Message..."
                  maxLength={mode === 'image' ? MAX_IMAGE_PROMPT_LENGTH : MAX_MESSAGE_LENGTH}
                  className={`w-full px-4 py-3 text-foreground bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                    validationError ? 'border-red-500' : 'border-border'
                  }`}
                  onKeyPress={(e) => e.key === 'Enter' && handleSubmit(e)}
                />
                {validationError && (
                  <p className="text-red-500 text-sm mt-1">{validationError}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {input.length}/{mode === 'image' ? MAX_IMAGE_PROMPT_LENGTH : MAX_MESSAGE_LENGTH} characters
                </p>
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
              disabled={!input.trim() || isLoading || rateLimited}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Sending...' : rateLimited ? 'Rate Limited' : 'Send'}
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
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-card-foreground">Chat Assistant</h1>
          <button
            onClick={startNewChat}
            className="flex items-center px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            New Chat
          </button>
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
                  <div className="mb-2">
                    <ImageWithFallback 
                      src={message.content} 
                      alt={message.prompt || "Generated image"}
                      className="max-w-full max-h-96 rounded-lg shadow-sm"
                    />
                  </div>
                  {message.prompt && (
                    <p className="text-sm text-muted-foreground italic">
                      "{message.prompt}"
                    </p>
                  )}
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
              onChange={(e) => {
                setInput(e.target.value);
                setValidationError(''); // Clear error on input change
              }}
              placeholder="Message..."
              maxLength={mode === 'image' ? MAX_IMAGE_PROMPT_LENGTH : MAX_MESSAGE_LENGTH}
              className={`w-full px-4 py-3 text-foreground bg-background border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                validationError ? 'border-red-500' : 'border-border'
              }`}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit(e)}
            />
            {validationError && (
              <p className="text-red-500 text-sm mt-1">{validationError}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {input.length}/{mode === 'image' ? MAX_IMAGE_PROMPT_LENGTH : MAX_MESSAGE_LENGTH} characters
            </p>
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
              disabled={!input.trim() || isLoading || rateLimited}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Sending...' : rateLimited ? 'Rate Limited' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
