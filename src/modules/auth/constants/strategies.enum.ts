/**
 * Stable names for Passport strategies registered in this app.
 * Match them in @UseGuards(AuthGuard(...)) calls.
 */
export enum StrategiesEnum {
  GOOGLE = 'google',
  COOKIE_JWT = 'cookie-jwt',
}
