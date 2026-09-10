import { clientConfig } from '../config';
import type { IceServer } from '../types';

export async function fetchIceServers(): Promise<IceServer[]> {
  try {
    const res = await fetch(`${clientConfig.apiUrl}/api/config`);
    if (!res.ok) throw new Error('config fetch failed');
    const data = (await res.json()) as { iceServers?: IceServer[] };
    return data.iceServers?.length
      ? data.iceServers
      : [{ urls: 'stun:stun.l.google.com:19302' }];
  } catch {
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
}
