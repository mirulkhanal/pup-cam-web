export type Role = 'puppy' | 'parent';

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

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};
