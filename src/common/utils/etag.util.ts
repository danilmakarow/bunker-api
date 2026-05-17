import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';

/**
 * Builds an `ETag` value from the room's monotonic version. Quoted per RFC 7232.
 */
export const buildVersionEtag = (version: number): string => `"v${version}"`;

/**
 * Sets the `ETag` header on the response and short-circuits with `304 Not
 * Modified` when the caller's `If-None-Match` matches. Returns `true` when
 * the caller should skip serialising the body (the response interceptor will
 * suppress the envelope for 304 responses).
 */
export const applyVersionEtag = (
  response: Response,
  ifNoneMatch: string | undefined,
  version: number,
): boolean => {
  const etag = buildVersionEtag(version);

  response.setHeader('ETag', etag);

  if (ifNoneMatch === etag) {
    response.status(HttpStatus.NOT_MODIFIED);

    return true;
  }

  return false;
};
