import type { Role } from '../types';

/** One household = one room. No codes to type. */
export const HOUSE_ROOM_ID = 'home';

const ROLE_KEY = 'pupcam:device-role';

export function getSavedRole(): Role | null {
  try {
    const role = localStorage.getItem(ROLE_KEY);
    if (role === 'puppy' || role === 'parent') return role;
    return null;
  } catch {
    return null;
  }
}

export function saveRole(role: Role) {
  localStorage.setItem(ROLE_KEY, role);
}

export function clearSavedRole() {
  localStorage.removeItem(ROLE_KEY);
}

/** Remove old room-code pairing key from earlier builds */
export function clearLegacyPairing() {
  try {
    localStorage.removeItem('pupcam:pairing');
  } catch {
    /* ignore */
  }
}
