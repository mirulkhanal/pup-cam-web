import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { HOUSE_ROOM_ID } from '../lib/device';
import { fetchIceServers } from '../lib/api';
import { disconnectSocket, getSocket } from '../lib/socket';
import type { JoinError, JoinOk, Role, RoomState } from '../types';

type Status = 'idle' | 'connecting' | 'waiting' | 'ready' | 'live' | 'error';

type Options = {
  role: Role;
};

export function usePupSession({ role }: Options) {
  const [status, setStatus] = useState<Status>('idle');
  const [roomId, setRoomId] = useState(HOUSE_ROOM_ID);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micEnabled, setMicEnabled] = useState(role === 'puppy');
  const [camEnabled, setCamEnabled] = useState(role === 'puppy');
  const [talkReady, setTalkReady] = useState(role === 'puppy');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioTransceiverRef = useRef<RTCRtpTransceiver | null>(null);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const wantMicRef = useRef(false);
  const polite = role === 'parent';
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;
    const socket = getSocket();
    socketRef.current = socket;

    async function makeOffer(pc: RTCPeerConnection) {
      try {
        makingOfferRef.current = true;
        await pc.setLocalDescription(await pc.createOffer());
        if (cancelled) return;
        socket.emit('webrtc:offer', { sdp: pc.localDescription });
      } catch (err) {
        console.error('createOffer failed', err);
      } finally {
        makingOfferRef.current = false;
      }
    }

    async function start() {
      setStatus('connecting');
      setError(null);

      try {
        const iceServers = await fetchIceServers();
        if (cancelled) return;

        const pc = new RTCPeerConnection({
          iceServers,
          iceCandidatePoolSize: 4,
        });
        pcRef.current = pc;

        if (role === 'puppy') {
          const media = await getPuppyMedia();
          if (cancelled) {
            stopMedia(media);
            return;
          }
          localStreamRef.current = media;
          setLocalStream(media);
          media.getTracks().forEach((track) => pc.addTrack(track, media));
        } else {
          // Video in only. Audio is sendrecv so we can replaceTrack(mic) later
          // without creating a broken second audio line.
          pc.addTransceiver('video', { direction: 'recvonly' });
          audioTransceiverRef.current = pc.addTransceiver('audio', {
            direction: 'sendrecv',
          });
        }

        const inbound = new MediaStream();
        setRemoteStream(inbound);
        const pendingIce: RTCIceCandidateInit[] = [];

        async function flushIce() {
          if (!pc.remoteDescription) return;
          while (pendingIce.length) {
            const candidate = pendingIce.shift();
            if (!candidate) continue;
            try {
              await pc.addIceCandidate(candidate);
            } catch (err) {
              if (!ignoreOfferRef.current) console.error(err);
            }
          }
        }

        pc.ontrack = (event) => {
          const track = event.track;
          if (!inbound.getTracks().some((t) => t.id === track.id)) {
            inbound.addTrack(track);
          }
          // Always publish a new MediaStream instance so <audio>/<video> refresh.
          setRemoteStream(new MediaStream(inbound.getTracks()));
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('webrtc:ice', { candidate: event.candidate });
          }
        };

        // Parent (polite) renegotiates after mic replaceTrack — only once the
        // first puppy↔parent handshake already has a remote description.
        pc.onnegotiationneeded = () => {
          if (cancelled || !polite) return;
          if (!pc.remoteDescription || pc.signalingState !== 'stable') return;
          void makeOffer(pc);
        };

        pc.onconnectionstatechange = () => {
          if (cancelled) return;
          if (pc.connectionState === 'connected') setStatus('live');
          if (pc.connectionState === 'failed') {
            setError(
              'Could not connect media between devices. If you are on Tailscale/cellular, you may need a TURN server.',
            );
            setStatus('error');
          }
          if (pc.connectionState === 'disconnected') {
            setStatus((s) => (s === 'error' ? s : 'ready'));
          }
        };

        socket.on('room-state', (state: RoomState) => {
          setRoom(state);
          setRoomId(state.roomId);
          if (state.ready) {
            setStatus((s) => (s === 'live' || s === 'error' ? s : 'ready'));
          } else {
            setStatus((s) => (s === 'live' || s === 'error' ? s : 'waiting'));
          }
        });

        socket.on('peer-joined', () => {
          if (role === 'puppy') void makeOffer(pc);
        });

        socket.on('peer-left', () => {
          setStatus('waiting');
        });

        socket.on('replaced', () => {
          setError('Another parent device took over this session.');
          setStatus('error');
        });

        socket.on('webrtc:offer', async (payload: { sdp: RTCSessionDescriptionInit }) => {
          if (!payload?.sdp) return;

          const offerCollision =
            makingOfferRef.current || pc.signalingState !== 'stable';
          ignoreOfferRef.current = !polite && offerCollision;
          if (ignoreOfferRef.current) {
            console.warn('Ignoring offer due to glare');
            return;
          }

          try {
            await pc.setRemoteDescription(payload.sdp);
            await flushIce();
            await pc.setLocalDescription(await pc.createAnswer());
            socket.emit('webrtc:answer', { sdp: pc.localDescription });
          } catch (err) {
            console.error(err);
            setError('Failed to answer WebRTC offer');
          }
        });

        socket.on('webrtc:answer', async (payload: { sdp: RTCSessionDescriptionInit }) => {
          if (!payload?.sdp) return;
          try {
            if (pc.signalingState === 'have-local-offer') {
              await pc.setRemoteDescription(payload.sdp);
              await flushIce();
            }
          } catch (err) {
            console.error(err);
          }
        });

        socket.on('webrtc:ice', async (payload: { candidate: RTCIceCandidateInit }) => {
          if (!payload?.candidate) return;
          if (!pc.remoteDescription) {
            pendingIce.push(payload.candidate);
            return;
          }
          try {
            await pc.addIceCandidate(payload.candidate);
          } catch (err) {
            if (!ignoreOfferRef.current) console.error(err);
          }
        });

        socket.on('webrtc:error', (payload: { error?: string }) => {
          console.warn('webrtc:error', payload);
        });

        socket.on('join-error', (payload: JoinError) => {
          setError(payload.error);
          setStatus('error');
        });

        await connectSocket(socket);
        if (cancelled) return;

        const joinResult = await joinHouse(socket, role);
        if (cancelled) return;

        setRoomId(joinResult.roomId);
        setRoom(joinResult.room);
        setStatus(joinResult.room.ready ? 'ready' : 'waiting');

        if (role === 'puppy' && joinResult.room.ready) {
          await makeOffer(pc);
        }
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(formatMediaError(err));
        setStatus('error');
      }
    }

    void start();

    return () => {
      cancelled = true;
      socket.emit('leave-room');
      socket.removeAllListeners();
      pcRef.current?.close();
      pcRef.current = null;
      audioTransceiverRef.current = null;
      stopMedia(localStreamRef.current);
      localStreamRef.current = null;
      disconnectSocket();
    };
  }, [role, polite]);

  function applyMicState() {
    const on = wantMicRef.current;
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach((t) => {
        t.enabled = on;
      });
    }
    setMicEnabled(on);
  }

  async function ensureParentMic(): Promise<boolean> {
    if (role !== 'parent') return true;
    if (localStreamRef.current?.getAudioTracks().length) return true;

    try {
      assertSecureMedia();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      const pc = pcRef.current;
      const audioTx = audioTransceiverRef.current;
      if (!pc || !audioTx) {
        stopMedia(stream);
        return false;
      }

      const track = stream.getAudioTracks()[0];
      if (!track) {
        stopMedia(stream);
        return false;
      }

      track.enabled = wantMicRef.current;
      await audioTx.sender.replaceTrack(track);

      localStreamRef.current = stream;
      setLocalStream(stream);
      setTalkReady(true);

      // replaceTrack should fire negotiationneeded; if not, offer explicitly.
      if (pc.remoteDescription && pc.signalingState === 'stable') {
        makingOfferRef.current = true;
        try {
          await pc.setLocalDescription(await pc.createOffer());
          socketRef.current?.emit('webrtc:offer', { sdp: pc.localDescription });
        } catch (err) {
          console.error('talk renegotiation failed', err);
        } finally {
          makingOfferRef.current = false;
        }
      }

      return true;
    } catch (err) {
      setError(formatMediaError(err));
      return false;
    }
  }

  function toggleMic() {
    wantMicRef.current = !wantMicRef.current;
    applyMicState();
  }

  async function setMic(on: boolean) {
    wantMicRef.current = on;

    if (role === 'parent' && on) {
      const ok = await ensureParentMic();
      if (!ok) {
        wantMicRef.current = false;
        applyMicState();
        return;
      }
    }

    applyMicState();
  }

  function toggleCam() {
    const stream = localStreamRef.current;
    if (!stream || role !== 'puppy') return;
    const next = !camEnabled;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCamEnabled(next);
  }

  function leave() {
    const socket = getSocket();
    socket.emit('webrtc:hangup');
    socket.emit('leave-room');
    pcRef.current?.close();
    pcRef.current = null;
    audioTransceiverRef.current = null;
    stopMedia(localStreamRef.current);
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setStatus('idle');
    disconnectSocket();
  }

  return {
    status,
    roomId,
    room,
    error,
    localStream,
    remoteStream,
    micEnabled,
    camEnabled,
    talkReady,
    toggleMic,
    setMic,
    toggleCam,
    leave,
  };
}

async function getPuppyMedia(): Promise<MediaStream> {
  assertSecureMedia();
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });
}

function assertSecureMedia() {
  if (!window.isSecureContext) {
    throw new Error(
      'Camera/mic need HTTPS. Open https://… on this device (not http://).',
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser cannot access camera/mic over the current URL.');
  }
}

function formatMediaError(err: unknown): string {
  if (!(err instanceof Error)) return 'Failed to start session';
  const name = 'name' in err ? String((err as DOMException).name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Permission denied — allow camera/mic for this site, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera/mic found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Camera/mic is already in use by another app.';
  }
  return err.message || 'Failed to start session';
}

function stopMedia(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

function connectSocket(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve();
      return;
    }

    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onErr = (err: Error) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onErr);
    };

    socket.on('connect', onConnect);
    socket.on('connect_error', onErr);
    socket.connect();
  });
}

function joinHouse(socket: Socket, role: Role): Promise<JoinOk> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error('Join timed out')), 10_000);

    socket.emit(
      'join-room',
      { roomId: HOUSE_ROOM_ID, role },
      (result: JoinOk | JoinError) => {
        window.clearTimeout(timeout);
        if (!result || !result.ok) {
          reject(new Error(result && !result.ok ? result.error : 'join failed'));
          return;
        }
        resolve(result);
      },
    );
  });
}
