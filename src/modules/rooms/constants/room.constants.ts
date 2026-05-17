/**
 * Domain constants for the Room feature. Centralised so tests and the
 * code generator agree on the same magic numbers.
 */

/** Length of a room code in characters. */
export const ROOM_CODE_LENGTH = 4;

/** Alphabet used for room codes. Full A–Z per TASK.md §10 (no skipping). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Hard cap on the number of seats per room. */
export const ROOM_MAX_PARTICIPANTS = 22;

/** Minimum JOINED participants required to start a game (admin uses this in M4). */
export const ROOM_MIN_PARTICIPANTS_TO_START = 4;

/** How many code-allocation attempts before we surface a 500. */
export const ROOM_CODE_ALLOCATION_ATTEMPTS = 16;
