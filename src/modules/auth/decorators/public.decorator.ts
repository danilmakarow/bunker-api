import { SetMetadata } from '@nestjs/common';

/**
 * Reflector key for marking a route as not requiring authentication.
 */
export const publicMetadataSymbol: unique symbol = Symbol('isPublic');

/**
 * Marks a route handler (or whole controller) as public — the cookie-JWT guard
 * will short-circuit `canActivate` and let the request through.
 */
export const Public = () => SetMetadata(publicMetadataSymbol, true);
