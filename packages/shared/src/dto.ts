/**
 * Response shapes (Data Transfer Objects). The server maps database rows to
 * these in each module's *.mapper.ts; the web app consumes them verbatim.
 * Dates are ISO-8601 strings because they cross a JSON boundary.
 */
import type {
  CommentStatus,
  LogKind,
  LogStatus,
  ReactionType,
  Role,
  StoryMood,
  StoryStatus,
  SubscriberStatus,
} from './constants';

export type ISODateString = string;

/** Success envelope: `{ data }`. Errors: `{ error: ApiErrorBody }`. */
export interface ApiSuccess<T> {
  data: T;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  avatarUrl: string | null;
  createdAt: ISODateString;
}

/** What other people may see about a user. Never includes the email. */
export interface PublicUserDto {
  id: string | null;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}

export interface AuthSessionDto {
  user: UserDto;
  accessToken: string;
  accessTokenExpiresAt: ISODateString;
}

export interface DeviceSessionDto {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: ISODateString;
  lastUsedAt: ISODateString;
  current: boolean;
}

export interface TagDto {
  id: string;
  name: string;
  slug: string;
  logCount: number;
}

export type ReactionCounts = Record<ReactionType, number>;

export interface LogSummaryDto {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  status: LogStatus;
  kind: LogKind;
  coverImageUrl: string | null;
  author: PublicUserDto;
  tags: TagDto[];
  allowComments: boolean;
  allowReactions: boolean;
  readingMinutes: number;
  viewCount: number;
  commentCount: number;
  reactionCounts: ReactionCounts;
  scheduledFor: ISODateString | null;
  liveStartedAt: ISODateString | null;
  liveEndedAt: ISODateString | null;
  publishedAt: ISODateString | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface LogDetailDto extends LogSummaryDto {
  content: string;
  /** Reactions the current viewer has already left (empty when anonymous). */
  viewerReactions: ReactionType[];
}

export interface CommentDto {
  id: string;
  logId: string;
  parentId: string | null;
  body: string;
  status: CommentStatus;
  author: PublicUserDto;
  createdAt: ISODateString;
  replies: CommentDto[];
}

export interface AdminCommentDto extends CommentDto {
  log: { id: string; title: string; slug: string };
}

export interface ReactionStateDto {
  logId: string;
  counts: ReactionCounts;
  viewerReactions: ReactionType[];
}

export interface StoryRequestDto {
  id: string;
  title: string;
  pitch: string;
  content: string;
  mood: StoryMood | null;
  isAnonymous: boolean;
  status: StoryStatus;
  adminNote: string | null;
  submitter: { id: string | null; displayName: string; email: string | null };
  contactEmail: string | null;
  publishedLog: { id: string; slug: string } | null;
  reviewedAt: ISODateString | null;
  createdAt: ISODateString;
}

export interface SubscriberDto {
  id: string;
  email: string;
  status: SubscriberStatus;
  confirmedAt: ISODateString | null;
  createdAt: ISODateString;
}

export interface LiveSessionDto {
  id: string;
  log: { id: string; title: string; slug: string; status: LogStatus };
  startedAt: ISODateString;
  endedAt: ISODateString | null;
  durationSeconds: number | null;
  peakViewers: number;
  notifiedSubscribers: number;
}

export interface LiveStatusDto {
  live: LogSummaryDto | null;
  next: LogSummaryDto | null;
  viewers: number;
  serverTime: ISODateString;
}

export interface AdminStatsDto {
  logs: Record<LogStatus, number>;
  communityLogs: number;
  subscribers: Record<SubscriberStatus, number>;
  pendingStories: number;
  comments: number;
  reactions: number;
  liveSessions: number;
  totalViews: number;
}

export interface MessageDto {
  message: string;
}
