import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { withTenant } from '../db/pool.js';

export type Role = 'admin' | 'quality_engineer' | 'operator' | 'auditor';
export interface AuthClaims { userId: string; tenantId: string; role: Role; }

declare global {
  namespace Express {
    interface Request { auth?: AuthClaims; }
  }
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
  return secret;
}

export function signToken(claims: AuthClaims): string {
  return jwt.sign(claims, jwtSecret(), { expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'] });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ error: 'Oturum açmanız gerekiyor.' }); return; }
  try {
    const claims = jwt.verify(token, jwtSecret()) as AuthClaims;
    const result = await withTenant(claims.tenantId, client => client.query('SELECT role,status FROM users WHERE tenant_id=$1 AND id=$2', [claims.tenantId, claims.userId]));
    const user = result.rows[0];
    if (!user || user.status !== 'active') { res.status(401).json({error:'Kullanıcı hesabı aktif değil.'}); return; }
    req.auth = {userId:claims.userId, tenantId:claims.tenantId, role:user.role};
    next();
  } catch {
    res.status(401).json({ error: 'Oturum süresi dolmuş veya token geçersiz.' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
      return;
    }
    next();
  };
}

