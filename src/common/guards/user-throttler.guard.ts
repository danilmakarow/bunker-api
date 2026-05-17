import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Rate-limit tracker that keys on the authenticated user when available and
 * falls back to the client IP otherwise. Without this every poller behind the
 * same NAT would share a single bucket.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(request: Request): Promise<string> {
    const user = request.requestStorage?.get('user');

    if (user) {
      return Promise.resolve(`user:${user.id}`);
    }

    const forwardedFor = request.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0]?.trim();

    return Promise.resolve(`ip:${forwardedIp ?? request.ip ?? 'unknown'}`);
  }
}
