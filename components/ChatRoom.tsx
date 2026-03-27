import React, { useState, useRef, useEffect } from 'react';
import { ChatRoomProps, Message } from '@/types';

const ChatRoom: React.FC<ChatRoomProps> = ({
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
  const [nickname] = useState(propNickname || '사용자');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const displayedMessages = externalMessages ?? messages;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayedMessages]);

  const handleSend = () => {
    if (sendDisabled) return;
    if (inputValue.trim()) {
      const text = inputValue.trim();
      const nick = nickname.trim() || '사용자';
      if (onSendMessage) {
        onSendMessage(text, nick);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: Date.now(), nickname: nick, text, timestamp: new Date() },
        ]);
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

export default ChatRoom;
