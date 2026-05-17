/**
 * Body of the session JWT we mint after Google OAuth.
 * `sub` is the user's uuid; `iat`/`exp` are populated by jsonwebtoken automatically.
 */
export interface ITokenPayload {
  sub: string;
}

/**
 * Same as ITokenPayload but with the timing claims added by passport-jwt at validate-time.
 */
export interface ITokenData extends ITokenPayload {
  iat: number;
  exp: number;
}
