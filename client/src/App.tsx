import { useState } from 'react';
import { Session } from './components/Session';
import { clientConfig } from './config';
import {
  clearLegacyPairing,
  clearSavedRole,
  getSavedRole,
  saveRole,
} from './lib/device';
import type { Role } from './types';
import './App.css';

clearLegacyPairing();

export default function App() {
  const [role, setRole] = useState<Role | null>(() => getSavedRole());
  const [active, setActive] = useState(() => Boolean(getSavedRole()));

  function choose(next: Role) {
    saveRole(next);
    setRole(next);
    setActive(true);
  }

  function goHome() {
    setActive(false);
  }

  function forgetDevice() {
    clearSavedRole();
    setRole(null);
    setActive(false);
  }

  if (active && role) {
    return <Session role={role} onExit={goHome} onForget={forgetDevice} />;
  }

  return (
    <div className="home">
      <div className="home__glow" aria-hidden />
      <main className="home__panel">
        <p className="home__eyebrow">Your house · one cam</p>
        <h1 className="home__brand">Pup Cam</h1>
        <p className="home__lede">
          No room codes. The PC runs the puppy camera; any phone on your Tailscale network can
          open this site and watch as a parent.
        </p>

        <div className="home__actions">
          {role ? (
            <div className="home__paired">
              <p className="home__paired-label">
                This device is set as <strong>{role === 'puppy' ? 'puppy camera' : 'parent'}</strong>
              </p>
              <button type="button" className="btn btn--primary" onClick={() => setActive(true)}>
                {role === 'puppy' ? 'Start puppy camera' : 'Open parent view'}
              </button>
              <button type="button" className="btn" onClick={forgetDevice}>
                Switch role
              </button>
            </div>
          ) : (
            <>
              <button type="button" className="btn btn--primary" onClick={() => choose('puppy')}>
                This PC is the puppy camera
              </button>
              <button type="button" className="btn" onClick={() => choose('parent')}>
                This phone watches (parent)
              </button>
            </>
          )}
        </div>

        <p className="home__hint">
          Connected via <code>{clientConfig.serverUrl}</code>
        </p>
      </main>
    </div>
  );
}
