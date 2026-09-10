export type Role = 'puppy' | 'parent';

export type Room = {
  puppySocketId?: string;
  parentSocketId?: string;
  createdAt: number;
};

export type SocketRoomMembership = {
  roomId: string;
  role: Role;
};

export type JoinPayload = {
  roomId: string;
  role: Role;
};

export type RoomState = {
  roomId: string;
  puppy: boolean;
  parent: boolean;
  ready: boolean;
};

export type JoinOk = {
  ok: true;
  roomId: string;
  role: Role;
  room: RoomState;
};

export type JoinError = {
  ok: false;
  error: string;
};

export type Ack<T = JoinOk | JoinError> = (result: T) => void;

export type WebRtcOfferPayload = {
  sdp: unknown;
};

export type WebRtcAnswerPayload = {
  sdp: unknown;
};

export type WebRtcIcePayload = {
  candidate: unknown;
};

export const ROLES: Role[] = ['puppy', 'parent'];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLES.includes(value as Role);
}

export function oppositeRole(role: Role): Role {
  return role === 'puppy' ? 'parent' : 'puppy';
}
