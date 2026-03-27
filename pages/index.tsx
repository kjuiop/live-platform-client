import { useEffect, useState } from 'react';
import Script from 'next/script';
import ChatRoom from '@/components/ChatRoom';
import { useChat } from '@/hooks/useChat';
import { getRooms, createRoom } from '@/lib/api';
import { DemoUser, RoomListItem } from '@/types';

const DEMO_USERS: DemoUser[] = [
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

export default function Home() {
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [isRoomsLoading, setIsRoomsLoading] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newChatRoomTitle, setNewChatRoomTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    connections,
    mainMessages,
    areWsScriptsReady,
    markWsScriptsReady,
    connectAllUsers,
    disconnectAllUsers,
    disconnectUserWs,
    sendChatMessage,
    clearMessages,
  } = useChat();

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
  }, []);

  useEffect(() => {
    return () => { DEMO_USERS.forEach((u) => disconnectUserWs(u.key)); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectChatRoom = () => {
    if (!selectedRoomId) {
      setRoomsError('연결할 채팅방을 먼저 선택해주세요.');
      return;
    }
    setRoomsError(null);
    const allConnected = DEMO_USERS.every(
      (u) => connections[u.key]?.connected && connections[u.key]?.connectedRoomId === selectedRoomId
    );
    if (allConnected) {
      disconnectAllUsers(DEMO_USERS);
      return;
    }
    clearMessages();
    connectAllUsers(DEMO_USERS, selectedRoomId);
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

  const handleModalKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) handleSaveChatRoom();
  };

  const isAllConnected = DEMO_USERS.every(
    (u) => connections[u.key]?.connected && connections[u.key]?.connectedRoomId === selectedRoomId
  );

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
                {isAllConnected ? '연결 끊기' : '연결'}
              </button>
            </div>
            {roomsError && (
              <div style={{ marginTop: 8, fontSize: 13, color: '#ef4444' }}>{roomsError}</div>
            )}
          </div>
        </div>

        <div className="sub-chat-grid">
          {DEMO_USERS.filter((u) => !u.isMain).map((u) => (
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
