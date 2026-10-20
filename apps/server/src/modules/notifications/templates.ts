import type { EmailOutboxRow } from '../../db/schema';
import type { EmailPayloads } from './email-jobs';
import type { MailMessage } from './mailer';

export interface RenderContext {
  publicUrl: string;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** A small "letter on aged paper" layout that survives email clients. */
function layout(opts: {
  heading: string;
  body: string;
  cta?: { label: string; url: string };
  footer?: string;
}) {
  const cta = opts.cta
    ? `<p style="margin:28px 0 8px;text-align:center">
        <a href="${escapeHtml(opts.cta.url)}" style="display:inline-block;background:#8f2d2d;color:#fdf6e3;text-decoration:none;font-family:Georgia,serif;font-size:16px;padding:12px 26px;border-radius:999px;letter-spacing:.04em">${escapeHtml(opts.cta.label)}</a>
      </p>`
    : '';
  return `<!doctype html>
<html><body style="margin:0;padding:32px 12px;background:#3e2a1f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#f6eedb;border-radius:6px;box-shadow:0 10px 30px rgba(0,0,0,.35)">
      <tr><td style="padding:36px 40px 12px;border-left:3px double #e3a6a6">
        <p style="margin:0 0 6px;font-family:'Courier New',monospace;font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#8a7458">Livelog · a diary, written live</p>
        <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-weight:normal;font-size:28px;line-height:1.25;color:#2b2118">${escapeHtml(opts.heading)}</h1>
        <div style="font-family:Georgia,serif;font-size:17px;line-height:1.65;color:#3b2e22">${opts.body}</div>
        ${cta}
      </td></tr>
      <tr><td style="padding:18px 40px 30px;border-left:3px double #e3a6a6">
        <p style="margin:0;font-family:Georgia,serif;font-style:italic;font-size:13px;line-height:1.5;color:#8a7458">${opts.footer ?? 'With ink-stained fingers,<br/>Livelog'}</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

type Rendered = Omit<MailMessage, 'to'>;

const renderers: {
  [K in keyof EmailPayloads]: (payload: EmailPayloads[K], ctx: RenderContext) => Rendered;
} = {
  subscribe_confirm: ({ token }, { publicUrl }) => {
    const url = `${publicUrl}/subscribe/confirm?token=${encodeURIComponent(token)}`;
    return {
      subject: 'Confirm your seat by the diary',
      html: layout({
        heading: 'One small confirmation',
        body: '<p>Someone (hopefully you) asked to receive a letter whenever a new live entry begins. Press the seal below to confirm.</p><p>If this was not you, simply ignore this note.</p>',
        cta: { label: 'Yes, write to me', url },
      }),
      text: `Confirm your Livelog subscription: ${url}\n\nIf this was not you, ignore this email.`,
    };
  },

  live_started: ({ logTitle, logSlug, excerpt, unsubscribeToken }, { publicUrl }) => {
    const url = `${publicUrl}/logs/${encodeURIComponent(logSlug)}`;
    const unsubscribeUrl = `${publicUrl}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
    const teaser = excerpt
      ? `<p style="border-left:2px solid #c9b48f;padding-left:14px;font-style:italic">${escapeHtml(excerpt)}</p>`
      : '<p>The page is still blank. Come watch the first words land.</p>';
    return {
      subject: `Live now: ${logTitle}`,
      html: layout({
        heading: `The ink is wet: “${logTitle}”`,
        body: `<p>I have just started writing, live. Pull up a chair and read along as the words appear.</p>${teaser}`,
        cta: { label: 'Join the live entry', url },
        footer: `You receive this because you subscribed to Livelog. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#8a7458">Unsubscribe</a>.`,
      }),
      text: `I'm writing live right now: "${logTitle}"\n\nJoin: ${url}\n\nUnsubscribe: ${unsubscribeUrl}`,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
      },
    };
  },

  story_reviewed: ({ storyTitle, accepted, note, logSlug }, { publicUrl }) => {
    const noteHtml = note ? `<p style="font-style:italic">“${escapeHtml(note)}”</p>` : '';
    if (accepted && logSlug) {
      const url = `${publicUrl}/logs/${encodeURIComponent(logSlug)}`;
      return {
        subject: `Your story “${storyTitle}” is now part of the diary`,
        html: layout({
          heading: 'Your story found its page',
          body: `<p>Thank you for trusting me with “${escapeHtml(storyTitle)}”. It is now published among the other diaries for readers to find.</p>${noteHtml}`,
          cta: { label: 'Read it in the diary', url },
        }),
        text: `Your story "${storyTitle}" was published: ${url}${note ? `\n\nNote: ${note}` : ''}`,
      };
    }
    return {
      subject: `About your story “${storyTitle}”`,
      html: layout({
        heading: 'Thank you for writing',
        body: `<p>Thank you for sharing “${escapeHtml(storyTitle)}”. I could not publish it this time, but I read every word.</p>${noteHtml}`,
      }),
      text: `Thank you for sharing "${storyTitle}". It was not published this time.${note ? `\n\nNote: ${note}` : ''}`,
    };
  },
};

export function renderEmail(
  row: Pick<EmailOutboxRow, 'kind' | 'payload'>,
  ctx: RenderContext,
): Rendered {
  const render = renderers[row.kind] as (payload: unknown, ctx: RenderContext) => Rendered;
  return render(row.payload, ctx);
}
