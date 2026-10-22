import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Cross-site request forgery guard for every state-changing API request.
 * Browsers always send `Origin` on POST/PUT/PATCH/DELETE; it must be one of the app origins.
 * Requests with no Origin are allowed only when they are not cross-site browser requests
 * (server-to-server calls and tests send neither Origin nor Sec-Fetch-Site).
 */
export function originCheck(allowedOrigins: string[]) {
  const allowed = new Set(allowedOrigins);
  return (request: Request, response: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(request.method)) return next();
    // Better Auth checks origins on its own routes; local storage uploads are authorised by their URL signature.
    if (request.path.startsWith('/api/auth/') || request.path.startsWith('/api/storage/upload/'))
      return next();
    const origin = request.headers.origin;
    const fetchSite = request.headers['sec-fetch-site'];
    const ok = origin
      ? allowed.has(origin)
      : fetchSite === undefined || fetchSite === 'same-origin' || fetchSite === 'none';
    if (ok) return next();
    response.status(403).json({ statusCode: 403, message: 'Request origin not allowed' });
  };
}
