import { VideoView } from './VideoView';
import { usePupSession } from '../hooks/usePupSession';
import type { Role } from '../types';

type Props = {
  role: Role;
  onExit: () => void;
  onForget: () => void;
};

const statusLabel: Record<string, string> = {
  idle: 'Idle',
  connecting: 'Connecting…',
  waiting: 'Waiting for the other side…',
  ready: 'Both here — linking video…',
  live: 'Live',
  error: 'Error',
};

export function Session({ role, onExit, onForget }: Props) {
  const session = usePupSession({ role });

  function handleExit() {
    session.leave();
    onExit();
  }

  function handleForget() {
    session.leave();
    onForget();
  }

  return (
    <div className="session">
      <header className="session__bar">
        <div>
          <p className="session__brand">Pup Cam</p>
          <p className="session__meta">
            {role === 'puppy' ? 'Puppy camera (PC)' : 'Parent view (phone)'}
          </p>
        </div>
        <div className="session__status" data-live={session.status === 'live'}>
          {statusLabel[session.status] || session.status}
        </div>
      </header>

      {role === 'puppy' && session.status === 'waiting' && (
        <p className="session__share">
          Camera is live on this PC. Open Pup Cam on your phone (same Tailscale URL) and choose
          parent to watch.
        </p>
      )}

      {role === 'parent' && session.status === 'waiting' && (
        <p className="session__share">
          Waiting for the puppy PC to start its camera…
        </p>
      )}

      {session.error && <p className="session__error">{session.error}</p>}

      <div className="session__stage">
        {role === 'parent' ? (
          <VideoView stream={session.remoteStream} mirror className="session__main" />
        ) : (
          <VideoView stream={session.localStream} muted mirror className="session__main" />
        )}
      </div>

      {role === 'puppy' && (
        <VideoView
          stream={session.remoteStream}
          muted={false}
          className="session__audio-only"
        />
      )}

      {role === 'parent' && session.micEnabled && (
        <p className="session__share">Talking… release to mute</p>
      )}

      <footer className="session__controls">
        {role === 'parent' ? (
          <button
            type="button"
            className={`btn btn--talk ${session.micEnabled ? 'is-on' : ''}`}
            onPointerDown={(e) => {
              // Capture so pointerup still fires even if finger slides off the button.
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              void session.setMic(true);
            }}
            onPointerUp={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
              void session.setMic(false);
            }}
            onPointerCancel={() => void session.setMic(false)}
            onLostPointerCapture={() => void session.setMic(false)}
            onContextMenu={(e) => e.preventDefault()}
          >
            Hold to talk
          </button>
        ) : (
          <>
            <button type="button" className="btn" onClick={session.toggleMic}>
              Mic {session.micEnabled ? 'on' : 'off'}
            </button>
            <button type="button" className="btn" onClick={session.toggleCam}>
              Cam {session.camEnabled ? 'on' : 'off'}
            </button>
          </>
        )}
        <button type="button" className="btn btn--danger" onClick={handleExit}>
          Leave
        </button>
        <button type="button" className="btn" onClick={handleForget}>
          Switch role
        </button>
      </footer>
    </div>
  );
}
