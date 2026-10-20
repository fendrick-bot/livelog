import type { EmailKind } from '../../db/schema';

/** Payload stored in email_outbox.payload for each kind of email. */
export interface EmailPayloads {
  subscribe_confirm: { token: string };
  live_started: {
    logTitle: string;
    logSlug: string;
    excerpt: string | null;
    unsubscribeToken: string;
  };
  story_reviewed: {
    storyTitle: string;
    accepted: boolean;
    note: string | null;
    logSlug: string | null;
  };
}

export type EmailJob = {
  [K in EmailKind]: { kind: K; toEmail: string; payload: EmailPayloads[K] };
}[EmailKind];
