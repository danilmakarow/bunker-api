/**
 * Subset of the Google OAuth profile we consume on callback.
 * Fields we don't read are intentionally omitted.
 */
export interface GoogleProfilePayload {
  googleId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}
