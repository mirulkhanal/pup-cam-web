import type { Role, Room, RoomState, SocketRoomMembership } from '../types.js';
import { oppositeRole } from '../types.js';
import { randomBytes } from 'node:crypto';

const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, SocketRoomMembership>();

export function createRoomId(): string {
  return randomBytes(2).toString('hex').toLowerCase();
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function createEmptyRoom(roomId?: string): { roomId: string; room: Room } {
  const id = roomId ?? createRoomId();
  const room: Room = { createdAt: Date.now() };
  rooms.set(id, room);
  return { roomId: id, room };
}

export function setRoom(roomId: string, room: Room): void {
  rooms.set(roomId, room);
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId);
}

export function listRoomIds(): string[] {
  return [...rooms.keys()];
}

export function getRoomState(roomId: string): RoomState {
  const room = rooms.get(roomId);
  const puppy = Boolean(room?.puppySocketId);
  const parent = Boolean(room?.parentSocketId);
  return {
    roomId,
    puppy,
    parent,
    ready: puppy && parent,
  };
}

export function getMembership(socketId: string): SocketRoomMembership | undefined {
  return socketToRoom.get(socketId);
}

export function setMembership(socketId: string, membership: SocketRoomMembership): void {
  socketToRoom.set(socketId, membership);
}

export function clearMembership(socketId: string): void {
  socketToRoom.delete(socketId);
}

export function getSlotKey(role: Role): 'puppySocketId' | 'parentSocketId' {
  return role === 'puppy' ? 'puppySocketId' : 'parentSocketId';
}

/** Socket id of the other role in this room, if present. */
export function getPeerSocketId(roomId: string, myRole: Role): string | undefined {
  const room = rooms.get(roomId);
  if (!room) return undefined;
  const peerRole = oppositeRole(myRole);
  return room[getSlotKey(peerRole)];
}
