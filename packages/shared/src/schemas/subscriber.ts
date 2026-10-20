import { z } from 'zod';
import { SUBSCRIBER_STATUSES } from '../constants';
import { emailSchema, paginationQuery, searchTerm } from './common';

export const subscribeInput = z.object({ email: emailSchema });
export type SubscribeInput = z.infer<typeof subscribeInput>;

export const listSubscribersQuery = paginationQuery.extend({
  status: z.enum(SUBSCRIBER_STATUSES).optional(),
  q: searchTerm.optional(),
});
export type ListSubscribersQuery = z.infer<typeof listSubscribersQuery>;
