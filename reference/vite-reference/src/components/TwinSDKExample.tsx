import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/sonner';
import { AvatarSessionManager } from '@soulcypher/twin-sdk';
import { isPlatformSDKConfigured } from '@/lib/twin-sdk';

/**
 * Twin SDK Chat Example Component
 *
 * This component demonstrates production-ready Twin SDK integration based on
 * the SoulCypher twin-portal implementation at https://app.soulcypher.ai
 *
 * Features demonstrated:
 * - SDK session initialization with event-driven architecture
 * - Real-time text chat with message streaming
 * - Proper error handling and loading states
 * - Clean session lifecycle management
 * - WebSocket-based avatar communication
 *
 * Usage:
 * 1. Set VITE_PLATFORM_API_KEY in .env.local (auto-provisioned by platform)
 * 2. Create an avatar in the SoulCypher platform (https://dev.soulcypher.ai)
 * 3. Replace DEMO_AVATAR_ID with your avatar ID
 * 4. Create a backend API endpoint to create sessions (see /api/sessions pattern below)
 * 5. Customize the UI to match your app's design system
 *
 * For production use, see: https://github.com/soulcypherai/twin-portal/blob/main/src/app/chat/[slug]/page.tsx
 * For full documentation: https://docs.soulcypher.ai
 */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Replace with your avatar ID from the SoulCypher platform
const DEMO_AVATAR_ID = 'your-avatar-id-here';

export function TwinSDKExample() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionManagerRef = useRef<AvatarSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isConfigured = isPlatformSDKConfigured();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Cleanup: disconnect session on unmount
    return () => {
      if (sessionManagerRef.current) {
        sessionManagerRef.current.disconnect();
      }
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /**
   * Initialize Avatar Session
   *
   * Production pattern from twin-portal:
   * 1. Call your backend API to create a session
   * 2. Your backend uses the Twin SDK to create the session with the platform
   * 3. Initialize AvatarSessionManager with the session data
   * 4. Set up event listeners for real-time communication
   * 5. Connect to the session (opens WebSocket connection)
   */
  const initializeSession = async () => {
    if (sessionManagerRef.current) {
      toast.info('Session already initialized');
      return;
    }

    if (!isConfigured) {
      toast.error('Platform API key not configured', {
        description: 'Set VITE_PLATFORM_API_KEY in .env.local',
      });
      return;
    }

    if (DEMO_AVATAR_ID === 'your-avatar-id-here') {
      toast.error('Avatar ID not configured', {
        description: 'Replace DEMO_AVATAR_ID in TwinSDKExample.tsx with your actual avatar ID',
      });
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      /**
       * Step 1: Create session via your backend API
       *
       * Your backend should implement an endpoint like this:
       *
       * POST /api/sessions
       * Body: { avatarId, userId, metadata }
       *
       * Backend implementation:
       * ```typescript
       * import { getPlatformSDK } from '@/lib/twin-sdk';
       *
       * export async function POST(request: Request) {
       *   const { avatarId, userId, metadata } = await request.json();
       *   const sdk = getPlatformSDK();
       *
       *   const session = await sdk.sessions.create({
       *     avatarId,
       *     userId,
       *     metadata
       *   });
       *
       *   return Response.json(session);
       * }
       * ```
       */
      const sessionResponse = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarId: DEMO_AVATAR_ID,
          userId: 'demo-user', // Replace with actual user ID
          metadata: { source: 'twin-sdk-example' }
        }),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        throw new Error(errorData.error || 'Failed to create session');
      }

      const sessionData = await sessionResponse.json();

      /**
       * Step 2: Initialize AvatarSessionManager
       *
       * The session manager handles WebSocket communication,
       * event dispatching, and session lifecycle.
       */
      const manager = new AvatarSessionManager(sessionData);

      /**
       * Step 3: Set up event listeners
       *
       * The Twin SDK uses an event-driven architecture for real-time updates.
       * Available events: avatar.status, avatar.input, avatar.response,
       * avatar.audio, avatar.video, avatar.error
       */

      // Avatar status updates (initializing, ready, etc.)
      manager.on('avatar.status', (event: { data?: { status?: string } }) => {
        console.log('Avatar status:', event.data?.status);
        if (event.data?.status === 'ready') {
          toast.success('Avatar is ready!');
          setIsInitializing(false);
        }
      });

      // User input echo (primarily for voice interactions)
      manager.on('avatar.input', (event: { data?: { inputType?: string; text?: string } }) => {
        if (event.data?.inputType === 'voice') {
          const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: event.data.text || 'Voice input received',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, userMessage]);
          setIsWaitingForResponse(true);
        }
      });

      // Avatar text response
      manager.on('avatar.response', (event: { data?: { text?: string } }) => {
        const assistantMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: event.data?.text || 'Response received',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsWaitingForResponse(false);
      });

      // Avatar errors
      manager.on('avatar.error', (event: { data?: { message?: string } }) => {
        console.error('Avatar error:', event.data);
        toast.error('Avatar error', {
          description: event.data?.message || 'Unknown error occurred'
        });
        setIsWaitingForResponse(false);
      });

      /**
       * Step 4: Connect to the session
       *
       * Opens WebSocket connection and starts the avatar session.
       */
      await manager.connect();

      sessionManagerRef.current = manager;
      setIsInitializing(false);

      toast.success('Session initialized', {
        description: 'You can now chat with the avatar'
      });

    } catch (err) {
      console.error('Failed to initialize session:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize session';
      setError(errorMessage);
      toast.error('Initialization failed', {
        description: errorMessage,
      });
      setIsInitializing(false);
    }
  };

  /**
   * Send a text message to the avatar
   *
   * Messages are sent via the session manager's sendMessage method.
   * The response arrives asynchronously via the 'avatar.response' event.
   */
  const sendMessage = async () => {
    if (!input.trim() || isSending) return;

    if (!sessionManagerRef.current) {
      toast.error('Session not initialized', {
        description: 'Click "Start Session" first',
      });
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);
    setIsWaitingForResponse(true);

    try {
      // Send message - response will arrive via 'avatar.response' event
      await sessionManagerRef.current.sendMessage(userMessage.content);
    } catch (err) {
      console.error('Failed to send message:', err);
      toast.error('Failed to send message', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      setIsWaitingForResponse(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <CardTitle>Twin SDK Chat Example</CardTitle>
        </div>
        <CardDescription>
          Production-ready implementation. Replace DEMO_AVATAR_ID and create /api/sessions endpoint.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration Warning */}
        {!isConfigured && (
          <div className="flex items-start gap-3 p-4 border border-yellow-500 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                Platform API Key Not Configured
              </p>
              <p className="text-yellow-700 dark:text-yellow-300">
                Set <code className="bg-yellow-100 dark:bg-yellow-900 px-1 py-0.5 rounded">VITE_PLATFORM_API_KEY</code> in your .env.local file.
                Get your API key from <a href="https://dev.soulcypher.ai" className="underline font-medium" target="_blank" rel="noopener noreferrer">dev.soulcypher.ai</a>
              </p>
            </div>
          </div>
        )}

        {/* Initialize Session Button */}
        {!sessionManagerRef.current && isConfigured && (
          <Button
            onClick={initializeSession}
            disabled={isInitializing}
            className="w-full"
          >
            {isInitializing ? 'Initializing...' : 'Start Session'}
          </Button>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-start gap-3 p-4 border border-red-500 rounded-lg bg-red-50 dark:bg-red-950/20">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-red-900 dark:text-red-100 mb-1">Error</p>
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium">Start a conversation</p>
                <p className="text-xs mt-1">Your AI avatar is ready to chat</p>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}

            {isWaitingForResponse && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSending || !sessionManagerRef.current}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isSending || !sessionManagerRef.current}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Setup Instructions */}
        <div className="text-xs text-muted-foreground space-y-2 pt-2 border-t">
          <p className="font-medium">💡 Next Steps to Enable This Component:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Replace <code className="bg-muted px-1 rounded">DEMO_AVATAR_ID</code> with your avatar ID</li>
            <li>Create a <code className="bg-muted px-1 rounded">/api/sessions</code> backend endpoint</li>
            <li>Add voice and video support if needed (see twin-portal example)</li>
            <li>Customize UI to match your app's design</li>
          </ol>
          <p className="text-xs pt-2">
            📚 Full example: <a href="https://github.com/soulcypherai/twin-portal" className="underline" target="_blank" rel="noopener noreferrer">github.com/soulcypherai/twin-portal</a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
