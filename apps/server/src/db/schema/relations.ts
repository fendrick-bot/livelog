import { relations } from 'drizzle-orm';
import { comments } from './comments';
import { liveSessions } from './live-sessions';
import { logs } from './logs';
import { storyRequests } from './story-requests';
import { logTags, tags } from './tags';
import { users } from './users';

// Relations power drizzle's relational query API (db.query.*.findMany({ with })).

export const logsRelations = relations(logs, ({ one, many }) => ({
  author: one(users, { fields: [logs.authorId], references: [users.id] }),
  logTags: many(logTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  logTags: many(logTags),
}));

export const logTagsRelations = relations(logTags, ({ one }) => ({
  log: one(logs, { fields: [logTags.logId], references: [logs.id] }),
  tag: one(tags, { fields: [logTags.tagId], references: [tags.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
  log: one(logs, { fields: [comments.logId], references: [logs.id] }),
}));

export const storyRequestsRelations = relations(storyRequests, ({ one }) => ({
  submitter: one(users, { fields: [storyRequests.submitterId], references: [users.id] }),
  publishedLog: one(logs, { fields: [storyRequests.publishedLogId], references: [logs.id] }),
}));

export const liveSessionsRelations = relations(liveSessions, ({ one }) => ({
  log: one(logs, { fields: [liveSessions.logId], references: [logs.id] }),
}));
