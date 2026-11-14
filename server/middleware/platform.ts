import type { RequestHandler } from 'express';
/** IDs are immutable and globally unique; matching an unverified email is not sufficient. */
export function isPlatformAdmin(userId: unknown, configuration = process.env.PLATFORM_ADMIN_USER_IDS || ''): boolean {
    return typeof userId === 'string' && userId.length > 0 && configuration.split(',').map(id => id.trim()).filter(Boolean).includes(userId);
}
export const requirePlatformAdmin: RequestHandler = (req, res, next) => {
    if (!req.auth || !isPlatformAdmin(req.auth.userId)) {
        res.status(403).json({ error: 'Bu panel yalnızca platform yöneticisine açıktır.' });
        return;
    }
    next();
};
