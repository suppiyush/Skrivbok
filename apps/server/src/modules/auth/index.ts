/**
 * Public surface of the auth module.
 *
 * Other modules must import from here, never reach into the service files
 * directly. The session helpers are exported because `middleware/auth.ts` needs
 * them to resolve a request's identity.
 */
export { authRouter } from './auth.routes.js';
export type { PublicUser, MeResponse } from './auth.service.js';
export type { SessionUser } from './session.service.js';
export { purgeExpiredSessions, revokeAllSessions } from './session.service.js';
