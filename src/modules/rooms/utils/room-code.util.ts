import { randomInt } from 'node:crypto';

import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from '../constants/room.constants';

/**
 * Builds a cryptographically-random 4-letter uppercase room code drawn from
 * the configured alphabet. Uniqueness is enforced by the DB unique index;
 * the caller retries on conflict.
 */
export const generateRoomCode = (): string => {
  let code = '';

  for (let position = 0; position < ROOM_CODE_LENGTH; position += 1) {
    code += ROOM_CODE_ALPHABET[randomInt(0, ROOM_CODE_ALPHABET.length)];
  }

  return code;
};

/**
 * Normalises a user-supplied code: uppercase + strips surrounding whitespace.
 * Throws nothing — validation that the result is a 4-letter A–Z string lives
 * in the DTO via class-validator.
 */
export const normaliseRoomCode = (code: string): string =>
  code.trim().toUpperCase();
