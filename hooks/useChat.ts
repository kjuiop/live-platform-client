import { useRef, useState } from 'react';
import { ConnectionState, DemoUser, Message } from '@/types';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

interface SendMessageIdentity {
  userId: string;
  username: string;
  sender: string;
}

interface UseChatReturn {
  connections: Record<string, ConnectionState>;
  mainMessages: Message[];
  areWsScriptsReady: boolean;
  markWsScriptsReady: () => void;
  connectAllUsers: (demoUsers: DemoUser[], roomId: string) => void;
  disconnectAllUsers: (demoUsers: DemoUser[]) => void;
  disconnectUserWs: (userKey: string) => void;
  sendChatMessage: (text: string, identity: SendMessageIdentity) => void;
  clearMessages: () => void;
}

export function useChat(): UseChatReturn {
  const clientsRef = useRef<Record<string, any>>({});
  const subsRef = useRef<Record<string, any>>({});
  const seenMessageKeysRef = useRef<Set<string>>(new Set());

  const [areWsScriptsReady, setAreWsScriptsReady] = useState(false);
  const [mainMessages, setMainMessages] = useState<Message[]>([]);
  const [connections, setConnections] = useState<Record<string, ConnectionState>>({});

  const markWsScriptsReady = () => {
    if (typeof window === 'undefined') return;
    const SockJS = (window as any).SockJS;
    const StompJs = (window as any).StompJs;
    if (SockJS && StompJs) setAreWsScriptsReady(true);
  };

  const disconnectUserWs = (userKey: string) => {
    try {
      if (subsRef.current[userKey]) {
        subsRef.current[userKey].unsubscribe?.();
        delete subsRef.current[userKey];
      }
      if (clientsRef.current[userKey]) {
        clientsRef.current[userKey].disconnect?.();
        delete clientsRef.current[userKey];
      }
    } finally {
      setConnections((prev) => ({
        ...prev,
        [userKey]: { connected: false, connectedRoomId: null, error: null },
      }));
    }
  };

  const appendIncomingMessage = (rawBody: string) => {
    if (seenMessageKeysRef.current.has(rawBody)) return;
    seenMessageKeysRef.current.add(rawBody);
    if (seenMessageKeysRef.current.size > 500) {
      seenMessageKeysRef.current = new Set(Array.from(seenMessageKeysRef.current).slice(-250));
    }
    try {
      const payload = JSON.parse(rawBody ?? '{}') as {
        roomId?: string;
        username?: string;
        sender?: string;
        message?: string;
        sentAt?: string;
      };
      const text = payload.message ?? rawBody ?? '';
      const nick = payload.sender || payload.username || '사용자';
      const ts = payload.sentAt ? new Date(payload.sentAt) : new Date();
      setMainMessages((prev) => [
        ...prev,
        { id: Date.now() + Math.random(), nickname: nick, text, timestamp: ts },
      ]);
    } catch {
      setMainMessages((prev) => [
        ...prev,
        { id: Date.now() + Math.random(), nickname: '사용자', text: rawBody ?? '', timestamp: new Date() },
      ]);
    }
  };

  const connectUserWsToRoom = (userKey: string, roomId: string) => {
    if (!areWsScriptsReady) {
      setConnections((prev) => ({
        ...prev,
        [userKey]: { connected: false, connectedRoomId: null, error: 'WebSocket 라이브러리 로딩 중입니다.' },
      }));
      return;
    }
    const SockJS = (window as any).SockJS;
    const StompJs = (window as any).StompJs;
    if (!SockJS || !StompJs) {
      setConnections((prev) => ({
        ...prev,
        [userKey]: { connected: false, connectedRoomId: null, error: 'SockJS 또는 STOMP 라이브러리가 로드되지 않았습니다.' },
      }));
      return;
    }
    disconnectUserWs(userKey);
    const socket = new SockJS(`${WS_BASE_URL}/ws`);
    const client = StompJs.Stomp.over(socket);
    client.debug = () => {};
    client.connect(
      {},
      () => {
        clientsRef.current[userKey] = client;
        setConnections((prev) => ({
          ...prev,
          [userKey]: { connected: true, connectedRoomId: roomId, error: null },
        }));
        subsRef.current[userKey] = client.subscribe(`/sub/room/${roomId}`, (message: any) => {
          appendIncomingMessage(message?.body ?? '');
        });
      },
      (e: any) => {
        setConnections((prev) => ({
          ...prev,
          [userKey]: {
            connected: false,
            connectedRoomId: null,
            error: typeof e === 'string' ? e : 'WebSocket 연결에 실패했습니다.',
          },
        }));
      }
    );
  };

  const connectAllUsers = (demoUsers: DemoUser[], roomId: string) => {
    demoUsers.forEach((u) => connectUserWsToRoom(u.key, roomId));
  };

  const disconnectAllUsers = (demoUsers: DemoUser[]) => {
    demoUsers.forEach((u) => disconnectUserWs(u.key));
  };

  const sendChatMessage = (text: string, identity: SendMessageIdentity) => {
    const userKey = identity.userId === 'main' ? 'main' : identity.userId;
    const state = connections[userKey];
    const client = clientsRef.current[userKey];
    if (!state?.connected || !client || !state.connectedRoomId) return;
    try {
      client.send(
        '/pub/chat.send',
        {},
        JSON.stringify({
          roomId: state.connectedRoomId,
          userId: identity.userId,
          username: identity.username,
          sender: identity.sender,
          message: text,
        })
      );
    } catch (e) {
      console.error('Failed to send STOMP message', e);
    }
  };

  const clearMessages = () => {
    setMainMessages([]);
    seenMessageKeysRef.current = new Set();
  };

  return {
    connections,
    mainMessages,
    areWsScriptsReady,
    markWsScriptsReady,
    connectAllUsers,
    disconnectAllUsers,
    disconnectUserWs,
    sendChatMessage,
    clearMessages,
  };
}
