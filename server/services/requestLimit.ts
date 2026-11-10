import {createHash} from 'node:crypto';
import type {RequestHandler} from 'express';
import {pool} from '../db/pool.js';

export function limitKey(scope: string, identity: string): string {
  return createHash('sha256').update(`${scope}:${identity}`).digest('hex');
}
export async function consumeLimit(scope: string, identity: string, maximum: number, seconds: number): Promise<boolean> {
  const result = await pool.query(`INSERT INTO request_limits(key_hash,attempts,expires_at)
    VALUES($1,1,now()+$2*interval '1 second')
    ON CONFLICT(key_hash) DO UPDATE SET
      attempts=CASE WHEN request_limits.expires_at<=now() THEN 1 ELSE request_limits.attempts+1 END,
      expires_at=CASE WHEN request_limits.expires_at<=now() THEN EXCLUDED.expires_at ELSE request_limits.expires_at END
    RETURNING attempts`, [limitKey(scope,identity),seconds]);
  return result.rows[0].attempts <= maximum;
}
export function requestLimit(scope: string, maximum: number, seconds=900): RequestHandler {
  return async (req,res,next) => {
    try {
      if (!await consumeLimit(scope,req.ip || 'unknown',maximum,seconds)) {
        res.setHeader('Retry-After',String(seconds));
        res.status(429).json({error:'Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.'});return;
      }
      next();
    } catch(error) { next(error); }
  };
}
