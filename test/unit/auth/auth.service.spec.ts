import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { mock, mockReset } from 'vitest-mock-extended';

import { AuthService } from '@/modules/auth/auth.service';
import { JwtService } from '@/modules/auth/services/jwt.service';
import { GoogleProfilePayload } from '@/modules/auth/types/google-profile.type';
import { User } from '@/modules/database/entities';
import { UserDatabaseService } from '@/modules/database/services';

describe('AuthService', () => {
  const userService = mock<UserDatabaseService>();
  const jwtService = mock<JwtService>();
  let service: AuthService;

  beforeEach(async () => {
    mockReset(userService);
    mockReset(jwtService);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserDatabaseService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('getMe', () => {
    it('returns the public identity fields for the user', () => {
      const user: User = {
        id: 'd5b1ef10-1111-4111-9111-111111111111',
        googleId: '110001234567890123456',
        email: 'player@example.com',
        name: 'Player One',
        avatarUrl: 'https://example.com/avatar.jpg',
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(service.getMe(user)).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        isAdmin: false,
      });
    });
  });

  describe('handleGoogleLogin', () => {
    const profile: GoogleProfilePayload = {
      googleId: '110001234567890123456',
      email: 'player@example.com',
      name: 'Player One',
      avatarUrl: null,
    };

    it('creates a new user when no row matches the googleId', async () => {
      const createdUser: User = {
        id: 'd5b1ef10-2222-4222-9222-222222222222',
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      userService.findByGoogleId.mockResolvedValue(null);
      userService.create.mockResolvedValue(createdUser);
      jwtService.signSessionAsync.mockResolvedValue('signed.jwt.token');
      jwtService.getExpireMs.mockReturnValue(30 * 24 * 60 * 60 * 1000);

      const result = await service.handleGoogleLogin(profile);

      expect(userService.create).toHaveBeenCalledWith({
        googleId: profile.googleId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      });
      expect(userService.update).not.toHaveBeenCalled();
      expect(jwtService.signSessionAsync).toHaveBeenCalledWith(createdUser.id);
      expect(result).toEqual({
        user: createdUser,
        token: 'signed.jwt.token',
        expireMs: 30 * 24 * 60 * 60 * 1000,
      });
    });

    it('refreshes profile fields when a user with the googleId already exists', async () => {
      const existing: User = {
        id: 'd5b1ef10-3333-4333-9333-333333333333',
        googleId: profile.googleId,
        email: 'old@example.com',
        name: 'Old Name',
        avatarUrl: null,
        isAdmin: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const updated: User = { ...existing, ...profile };

      userService.findByGoogleId.mockResolvedValue(existing);
      userService.update.mockResolvedValue(updated);
      jwtService.signSessionAsync.mockResolvedValue('signed.jwt.token');
      jwtService.getExpireMs.mockReturnValue(60_000);

      const result = await service.handleGoogleLogin(profile);

      expect(userService.update).toHaveBeenCalledWith(existing, {
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      });
      expect(userService.create).not.toHaveBeenCalled();
      expect(result.user).toEqual(updated);
      expect(result.token).toBe('signed.jwt.token');
      expect(result.expireMs).toBe(60_000);
    });
  });
});
