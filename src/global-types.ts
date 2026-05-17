/* eslint-disable @typescript-eslint/no-namespace */
import { TypedMap } from './common/types/typed-map.type';
import { User as UserEntity } from '@/modules/database/entities';

declare global {
  namespace Express {
    interface Request {
      /**
       * Request-scoped typed storage. Strategies set `user` here after a successful
       * cookie/JWT validation; the @AuthorizedUser decorator reads it out.
       */
      requestStorage: TypedMap<{
        user: UserEntity | undefined;
      }>;
    }
  }
}
