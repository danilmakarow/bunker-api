import { describe, expect, it } from 'vitest';

import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
} from '@/modules/rooms/constants/room.constants';
import {
  generateRoomCode,
  normaliseRoomCode,
} from '@/modules/rooms/utils/room-code.util';

describe('room-code utilities', () => {
  describe('generateRoomCode', () => {
    it('returns a string of ROOM_CODE_LENGTH characters from the configured alphabet', () => {
      const alphabet = new Set(ROOM_CODE_ALPHABET);

      for (let trial = 0; trial < 50; trial += 1) {
        const code = generateRoomCode();

        expect(code).toHaveLength(ROOM_CODE_LENGTH);

        for (const letter of code) {
          expect(alphabet.has(letter)).toBe(true);
        }
      }
    });
  });

  describe('normaliseRoomCode', () => {
    it('uppercases and trims surrounding whitespace', () => {
      expect(normaliseRoomCode('  abcd  ')).toBe('ABCD');
      expect(normaliseRoomCode('AbCd')).toBe('ABCD');
    });
  });
});
