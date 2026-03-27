import React, { useState, useRef, useEffect } from 'react';
import Script from 'next/script';

interface ChatRoomProps {
  title: string;
  isMain?: boolean;
  nickname?: string;
  connectionStatusText?: string;
  connectedRoomTitle?: string;
  externalMessages?: Message[];
  onSendMessage?: (text: string, nickname: string) => void;
  sendDisabled?: boolean;
}

interface Message {
  id: number;
  nickname: string;
  text: string;
  timestamp: Date;
}

interface ApiResponse<T> {
  data: T;
  error: null | {
    code: string;
    message: string;
  };
}

interface CreateRoomResponse {
  roomId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface RoomListItem {
  roomId: string;
  title: string;
}

type DemoUser = {
  key: string;
  userId: string;
  username: string;
  sender: string;
  isMain?: boolean;
};

type ConnectionState = {
  connected: boolean;
  connectedRoomId: string | null;
  error: string | null;
};

const ChatRoom: React.FC<ChatRoomProps> = ({
  title,
  isMain = false,
  nickname: propNickname,
  connectionStatusText,
  connectedRoomTitle,
  externalMessages,
  onSendMessage,
  sendDisabled = false,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [nickname, setNickname] = useState(propNickname || '사용자');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const displayedMessages = externalMessages ?? messages;

  useEffect(() => {
    scrollToBottom();
  }, [displayedMessages]);

  const handleSend = () => {
    if (sendDisabled) return;
    if (inputValue.trim()) {
      const text = inputValue.trim();
      const nick = nickname.trim() || '사용자';
      if (onSendMessage) {
        onSendMessage(text, nick);
      } else {
        const newMessage: Message = {
          id: Date.now(),
          nickname: nick,
          text,
          timestamp: new Date(),
        };
        setMessages([...messages, newMessage]);
      }
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className={`chat-room ${isMain ? 'main' : ''}`}>
      <div className={`chat-room-header ${isMain ? 'main' : ''}`}>
        <span>{nickname}의 채팅창</span>
        <span className="connection-right">
          {connectedRoomTitle && (
            <span className="connected-room-title">{connectedRoomTitle}</span>
          )}
          {connectionStatusText && (
            <span className="connection-status">{connectionStatusText}</span>
          )}
        </span>
      </div>
      <div className="chat-room-messages">
        {displayedMessages.length === 0 ? (
          <div className="chat-room-empty">채팅 메시지가 여기에 표시됩니다...</div>
        ) : (
          <>
            {displayedMessages.map((msg) => (
              <div key={msg.id} className="chat-message">
                <div className="chat-message-content">
                  <span className="chat-message-nickname">{msg.nickname}</span>
                  <span className="chat-message-separator">|</span>
                  <span className="chat-message-text">{msg.text}</span>
                  <span className="chat-message-time">{msg.timestamp.toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      <div className="chat-room-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="메시지를 입력하세요..."
          className="chat-input"
          disabled={sendDisabled}
        />
        <button
          onClick={handleSend}
          className={`chat-send-btn ${isMain ? 'main' : ''}`}
          disabled={sendDisabled}
        >
          전송
        </button>
      </div>
    </div>
  );
};

export default function Home() {
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newChatRoomTitle, setNewChatRoomTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientsRef = useRef<Record<string, any>>({});
  const subsRef = useRef<Record<string, any>>({});
  const [areWsScriptsReady, setAreWsScriptsReady] = useState(false);
  const [mainMessages, setMainMessages] = useState<Message[]>([]);
  const [connections, setConnections] = useState<Record<string, ConnectionState>>({});
  const seenMessageKeysRef = useRef<Set<string>>(new Set());

  const demoUsers: DemoUser[] = [
    { key: 'main', userId: 'main', username: 'main@example.com', sender: '메인 사용자', isMain: true },
    { key: 'user1', userId: 'user1', username: 'user1@example.com', sender: '사용자1' },
    { key: 'user2', userId: 'user2', username: 'user2@example.com', sender: '사용자2' },
    { key: 'user3', userId: 'user3', username: 'user3@example.com', sender: '사용자3' },
    { key: 'user4', userId: 'user4', username: 'user4@example.com', sender: '사용자4' },
    { key: 'user5', userId: 'user5', username: 'user5@example.com', sender: '사용자5' },
    { key: 'user6', userId: 'user6', username: 'user6@example.com', sender: '사용자6' },
    { key: 'user7', userId: 'user7', username: 'user7@example.com', sender: '사용자7' },
    { key: 'user8', userId: 'user8', username: 'user8@example.com', sender: '사용자8' },
    { key: 'user9', userId: 'user9', username: 'user9@example.com', sender: '사용자9' },
  ];

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || API_BASE_URL;

  const getRooms = async (size = 50): Promise<RoomListItem[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/rooms?size=${size}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `채팅방 목록 조회 실패: ${response.status}`);
      }
      const apiResponse: ApiResponse<RoomListItem[]> = await response.json();
      return apiResponse.data ?? [];
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        throw new Error(`서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요. (${API_BASE_URL})`);
      }
      throw err;
    }
  };

  const createRoom = async (title: string): Promise<CreateRoomResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `채팅방 생성 실패: ${response.status}`);
      }
      const apiResponse: ApiResponse<CreateRoomResponse> = await response.json();
      return apiResponse.data;
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        throw new Error(`서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요. (${API_BASE_URL})`);
      }
      throw err;
    }
  };

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
    const key = rawBody;
    if (seenMessageKeysRef.current.has(key)) return;
    seenMessageKeysRef.current.add(key);
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

  const handleConnectChatRoom = () => {
    if (!selectedRoomId) {
      setRoomsError('연결할 채팅방을 먼저 선택해주세요.');
      return;
    }
    setRoomsError(null);
    const allConnected = demoUsers.every(
      (u) => connections[u.key]?.connected && connections[u.key]?.connectedRoomId === selectedRoomId
    );
    if (allConnected) {
      demoUsers.forEach((u) => disconnectUserWs(u.key));
      return;
    }
    setMainMessages([]);
    seenMessageKeysRef.current = new Set();
    demoUsers.forEach((u) => connectUserWsToRoom(u.key, selectedRoomId));
  };

  const sendChatMessage = (
    text: string,
    identity: { userId: string; username: string; sender: string }
  ) => {
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

  const handleCloseModal = () => {
    if (isLoading) return;
    setIsModalOpen(false);
    setNewChatRoomTitle('');
    setError(null);
  };

  const handleSaveChatRoom = async () => {
    const title = newChatRoomTitle.trim();
    if (!title) {
      setError('채팅방 제목을 입력해주세요.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await createRoom(title);
      const newRoom: RoomListItem = { roomId: response.roomId, title: response.title };
      setRooms((prev) => [newRoom, ...prev.filter((r) => r.roomId !== newRoom.roomId)]);
      setSelectedRoomId(response.roomId);
      handleCloseModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : '채팅방 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsRoomsLoading(true);
      setRoomsError(null);
      try {
        const fetched = await getRooms(50);
        if (cancelled) return;
        setRooms(fetched);
        if (fetched.length > 0) {
          setSelectedRoomId((prev) => prev || fetched[0].roomId);
        } else {
          setSelectedRoomId('');
        }
      } catch (e) {
        if (cancelled) return;
        setRoomsError(e instanceof Error ? e.message : '채팅방 목록 조회에 실패했습니다.');
      } finally {
        if (!cancelled) setIsRoomsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => { demoUsers.forEach((u) => disconnectUserWs(u.key)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleModalKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) handleSaveChatRoom();
  };

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js"
        strategy="afterInteractive"
        onLoad={markWsScriptsReady}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@stomp/stompjs@7/bundles/stomp.umd.min.js"
        strategy="afterInteractive"
        onLoad={markWsScriptsReady}
      />
      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%);
          min-height: 100vh;
          padding: 20px;
        }
        .main-container { max-width: 1400px; margin: 0 auto; }
        .page-header {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white; padding: 30px; text-align: center;
          border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); margin-bottom: 30px;
        }
        .page-header h1 { font-size: 28px; margin: 0; }
        .main-content { display: flex; gap: 20px; margin-bottom: 30px; align-items: flex-start; }
        .main-chat-wrapper { width: calc(66.67% - 6.67px); }
        .control-panel {
          flex: 1; background: white; border-radius: 12px; padding: 20px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1); min-height: 400px;
        }
        .control-panel-title {
          font-size: 20px; font-weight: 600; color: #1f2937;
          margin-bottom: 15px; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;
        }
        .control-panel-controls { display: flex; gap: 10px; align-items: center; }
        .control-select {
          flex: 1; padding: 8px 12px; border: 1px solid #d1d5db;
          border-radius: 6px; font-size: 13px; background: white; cursor: pointer; outline: none;
        }
        .control-select:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
        .btn-create {
          padding: 8px 16px; background: #10b981; color: white; border: none;
          border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;
        }
        .btn-create:hover { background: #059669; }
        .btn-connect {
          padding: 8px 16px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 600;
          cursor: pointer; white-space: nowrap;
        }
        .btn-connect:disabled { opacity: 0.6; cursor: not-allowed; }
        .sub-chat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .chat-room {
          background: white; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          display: flex; flex-direction: column; height: 200px; overflow: hidden;
        }
        .chat-room.main { height: 400px; }
        .chat-room-header {
          padding: 12px 16px; background: #f9fafb; color: #1f2937; font-weight: 600;
          font-size: 14px; border-bottom: 1px solid #e5e7eb;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .chat-room-header.main {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white; font-size: 18px;
        }
        .connection-status { font-size: 13px; font-weight: 600; white-space: nowrap; }
        .connection-right { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
        .connected-room-title {
          font-size: 13px; font-weight: 600; white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis; max-width: 320px;
        }
        .chat-room-messages {
          flex: 1; padding: 12px; overflow-y: auto;
          display: flex; flex-direction: column; gap: 8px; font-size: 11px; color: #1f2937;
        }
        .chat-room.main .chat-room-messages { font-size: 14px; }
        .chat-room-empty { color: #9ca3af; font-style: italic; font-size: 10px; text-align: center; margin-top: 20px; }
        .chat-room.main .chat-room-empty { font-size: 13px; }
        .chat-message { padding: 8px 12px; background: #f9fafb; border-radius: 6px; word-break: break-word; }
        .chat-message-content { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 11px; }
        .chat-room.main .chat-message-content { font-size: 13px; }
        .chat-message-nickname { font-weight: 600; color: #667eea; }
        .chat-message-separator { color: #9ca3af; }
        .chat-message-text { flex: 1; }
        .chat-message-time { font-size: 10px; color: #9ca3af; }
        .chat-room-input { border-top: 1px solid #e5e7eb; padding: 12px; display: flex; gap: 8px; }
        .chat-input {
          flex: 1; padding: 10px; border: 1px solid #d1d5db;
          border-radius: 6px; font-size: 14px; outline: none;
        }
        .chat-input:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
        .chat-send-btn {
          padding: 10px 20px; background: #6c757d; color: white; border: none;
          border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;
        }
        .chat-send-btn.main { background: #6366f1; }
        .chat-send-btn.main:hover { background: #4f46e5; }
        .chat-send-btn:not(.main):hover { background: #5a6268; }
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;
        }
        .modal-content {
          background: white; border-radius: 12px; padding: 30px;
          width: 90%; max-width: 500px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .modal-title { font-size: 24px; font-weight: 600; margin-bottom: 20px; color: #1f2937; }
        .modal-form-group { margin-bottom: 20px; }
        .modal-label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 600; color: #374151; }
        .modal-input {
          width: 100%; padding: 12px; border: 1px solid #d1d5db;
          border-radius: 6px; font-size: 14px; outline: none;
        }
        .modal-input:focus { border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
        .modal-input:disabled { background-color: #f3f4f6; cursor: not-allowed; }
        .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .btn-cancel {
          padding: 10px 20px; background: #6c757d; color: white; border: none;
          border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;
        }
        .btn-cancel:hover { background: #5a6268; }
        .btn-save {
          padding: 10px 20px; background: #10b981; color: white; border: none;
          border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer;
        }
        .btn-save:hover:not(:disabled) { background: #059669; }
        .btn-save:disabled, .btn-cancel:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 768px) {
          .main-content { flex-direction: column; }
          .main-chat-wrapper { width: 100%; }
          .sub-chat-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="main-container">
        <div className="page-header">
          <h1>Live Platform - 채팅방</h1>
        </div>

        <div className="main-content">
          <div className="main-chat-wrapper">
            <ChatRoom
              title={rooms.find((r) => r.roomId === selectedRoomId)?.title || ''}
              isMain={true}
              nickname="메인 사용자"
              connectionStatusText={connections['main']?.connected ? '연결됨' : '연결 안 됨'}
              connectedRoomTitle={
                connections['main']?.connectedRoomId
                  ? rooms.find((r) => r.roomId === connections['main']?.connectedRoomId)?.title ||
                    connections['main']?.connectedRoomId ||
                    undefined
                  : undefined
              }
              externalMessages={mainMessages}
              onSendMessage={(text) =>
                sendChatMessage(text, { userId: 'main', username: 'main@example.com', sender: '메인 사용자' })
              }
              sendDisabled={!connections['main']?.connected}
            />
          </div>

          <div className="control-panel">
            <div className="control-panel-title">채팅방 선택</div>
            <div className="control-panel-controls">
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="control-select"
                disabled={isRoomsLoading || rooms.length === 0}
              >
                {isRoomsLoading ? (
                  <option value="">불러오는 중...</option>
                ) : rooms.length === 0 ? (
                  <option value="">채팅방이 없습니다</option>
                ) : (
                  rooms.map((room) => (
                    <option key={room.roomId} value={room.roomId}>
                      {room.title}
                    </option>
                  ))
                )}
              </select>
              <button onClick={() => { setIsModalOpen(true); setError(null); }} className="btn-create">
                생성
              </button>
              <button
                onClick={handleConnectChatRoom}
                className="btn-connect"
                disabled={isRoomsLoading || rooms.length === 0 || !selectedRoomId || !areWsScriptsReady}
              >
                {demoUsers.every(
                  (u) => connections[u.key]?.connected && connections[u.key]?.connectedRoomId === selectedRoomId
                )
                  ? '연결 끊기'
                  : '연결'}
              </button>
            </div>
            {roomsError && (
              <div style={{ marginTop: 8, fontSize: 13, color: '#ef4444' }}>{roomsError}</div>
            )}
          </div>
        </div>

        <div className="sub-chat-grid">
          {demoUsers
            .filter((u) => !u.isMain)
            .map((u) => (
              <ChatRoom
                key={u.userId}
                title={rooms.find((r) => r.roomId === selectedRoomId)?.title || ''}
                nickname={u.sender}
                connectionStatusText={connections[u.key]?.connected ? '연결됨' : '연결 안 됨'}
                connectedRoomTitle={
                  connections[u.key]?.connectedRoomId
                    ? rooms.find((r) => r.roomId === connections[u.key]?.connectedRoomId)?.title ||
                      connections[u.key]?.connectedRoomId ||
                      undefined
                    : undefined
                }
                externalMessages={mainMessages}
                onSendMessage={(text) => sendChatMessage(text, u)}
                sendDisabled={!connections[u.key]?.connected}
              />
            ))}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">채팅방 생성</h2>
            <div className="modal-form-group">
              <label className="modal-label">채팅방 제목</label>
              <input
                type="text"
                value={newChatRoomTitle}
                onChange={(e) => { setNewChatRoomTitle(e.target.value); setError(null); }}
                onKeyPress={handleModalKeyPress}
                placeholder="채팅방 제목을 입력하세요"
                className="modal-input"
                autoFocus
                disabled={isLoading}
              />
              {error && (
                <div style={{ color: '#ef4444', fontSize: 14, marginTop: 8 }}>{error}</div>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={handleCloseModal} className="btn-cancel" disabled={isLoading}>
                취소
              </button>
              <button
                onClick={handleSaveChatRoom}
                className="btn-save"
                disabled={isLoading || !newChatRoomTitle.trim()}
              >
                {isLoading ? '생성 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
