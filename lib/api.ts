import { ApiResponse, CreateRoomResponse, RoomListItem } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

export async function getRooms(size = 50): Promise<RoomListItem[]> {
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
}

export async function createRoom(title: string): Promise<CreateRoomResponse> {
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
}
