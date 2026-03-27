export interface Message {
  id: number;
  nickname: string;
  text: string;
  timestamp: Date;
}

export interface ApiResponse<T> {
  data: T;
  error: null | {
    code: string;
    message: string;
  };
}

export interface CreateRoomResponse {
  roomId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomListItem {
  roomId: string;
  title: string;
}

export type DemoUser = {
  key: string;
  userId: string;
  username: string;
  sender: string;
  isMain?: boolean;
};

export type ConnectionState = {
  connected: boolean;
  connectedRoomId: string | null;
  error: string | null;
};

export interface ChatRoomProps {
  title: string;
  isMain?: boolean;
  nickname?: string;
  connectionStatusText?: string;
  connectedRoomTitle?: string;
  externalMessages?: Message[];
  onSendMessage?: (text: string, nickname: string) => void;
  sendDisabled?: boolean;
}
