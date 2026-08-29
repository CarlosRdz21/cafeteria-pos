"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginRateLimiter = exports.securityHeaders = void 0;
exports.resetLoginRateLimiter = resetLoginRateLimiter;
const loginAttempts = new Map();
function getPositiveInteger(value, fallback) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
const securityHeaders = (_req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
};
exports.securityHeaders = securityHeaders;
const loginRateLimiter = (req, res, next) => {
    const now = Date.now();
    const windowMs = getPositiveInteger(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
    const maximumAttempts = getPositiveInteger(process.env.LOGIN_RATE_LIMIT_MAX, 10);
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = loginAttempts.get(key);
    if (!current || current.resetAt <= now) {
        loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
        next();
        return;
    }
    current.count += 1;
    res.setHeader('RateLimit-Limit', String(maximumAttempts));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, maximumAttempts - current.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));
    if (current.count > maximumAttempts) {
        const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
        res.setHeader('Retry-After', String(retryAfterSeconds));
        res.status(429).json({ error: 'Too many login attempts' });
        return;
    }
    next();
};
exports.loginRateLimiter = loginRateLimiter;
function resetLoginRateLimiter() {
    loginAttempts.clear();
}
