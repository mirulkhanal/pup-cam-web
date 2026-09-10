import type { Request, Response, NextFunction } from 'express';
import { env } from '../config.js';

export function requireHttpAuth(req: Request, res: Response, next: NextFunction) {
  if (!env.requireAuth) {
    next();
    return;
  }

  const header = req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token || token !== env.authToken) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  next();
}
