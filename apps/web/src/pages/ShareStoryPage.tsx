import {
  LIMITS,
  STORY_MOODS,
  submitStoryInput,
  wordCount,
  type StoryMood,
  type StoryRequestDto,
  type SubmitStoryInput,
} from '@livelog/shared';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMyStories, useSubmitStory } from '../api/stories';
import { Button, ButtonLink } from '../components/diary/Button';
import { SectionTitle } from '../components/diary/Feedback';
import { Checkbox, TextArea, TextField } from '../components/diary/Field';
import { Paper, Tape } from '../components/diary/Paper';
import { Stamp } from '../components/diary/Stamp';
import { useAuth } from '../lib/auth';
import { cn } from '../lib/cn';
import { apiFieldErrors, validate, type FieldErrors } from '../lib/form';
import { shortDay } from '../lib/format';
import { storage } from '../lib/storage';

const MOODS: Record<StoryMood, { emoji: string; label: string; prompt: string }> = {
  hopeful: {
    emoji: '🌱',
    label: 'Hopeful',
    prompt: 'What are you quietly hoping for, and when did it start?',
  },
  nostalgic: {
    emoji: '📻',
    label: 'Nostalgic',
    prompt: 'Which room, smell or song takes you straight back?',
  },
  grateful: { emoji: '🕯️', label: 'Grateful', prompt: 'Who never knew how much they helped you?' },
  heartbroken: {
    emoji: '🥀',
    label: 'Heartbroken',
    prompt: 'What do you wish you had said, while there was still time?',
  },
  curious: {
    emoji: '🔭',
    label: 'Curious',
    prompt: 'What question has followed you around for years?',
  },
  brave: {
    emoji: '⛰️',
    label: 'Brave',
    prompt: 'When did you do the thing that scared you anyway?',
  },
};

const STEPS = ['Mood', 'Name it', 'Write it', 'Sign it'] as const;
const STEP_FIELDS: Array<Array<keyof SubmitStoryInput>> = [
  ['mood'],
  ['title', 'pitch'],
  ['content'],
  ['contactEmail', 'consent'],
];
const DRAFT_KEY = 'livelog:story-draft';

interface Draft {
  mood: StoryMood | null;
  title: string;
  pitch: string;
  content: string;
  isAnonymous: boolean;
  contactEmail: string;
  consent: boolean;
}

const EMPTY: Draft = {
  mood: null,
  title: '',
  pitch: '',
  content: '',
  isAnonymous: false,
  contactEmail: '',
  consent: false,
};

const STATUS_TONE = { pending: 'quill', accepted: 'moss', rejected: 'faded' } as const;

function MyLetters({ stories }: { stories: StoryRequestDto[] }) {
  if (stories.length === 0) return null;
  return (
    <section className="mt-14">
      <SectionTitle eyebrow="Your letters" title="Stories you've sent" />
      <ul className="grid gap-5 sm:grid-cols-2">
        {stories.map((story) => (
          <li key={story.id}>
            <Paper className="flex h-full flex-col gap-2 p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-type text-[0.7rem] uppercase tracking-widest text-ink-faded">
                  {shortDay(story.createdAt)}
                </span>
                <Stamp tone={STATUS_TONE[story.status]}>{story.status}</Stamp>
              </div>
              <p className="font-hand text-3xl leading-tight">{story.title}</p>
              <p className="line-clamp-2 italic text-ink-soft">{story.pitch}</p>
              {story.adminNote && (
                <p className="border-l-2 border-margin pl-3 text-sm italic text-ink-faded">
                  “{story.adminNote}”
                </p>
              )}
              {story.publishedLog && (
                <Link
                  to={`/logs/${story.publishedLog.slug}`}
                  className="link-ink mt-auto w-fit text-quill"
                >
                  Read it in the diary →
                </Link>
              )}
            </Paper>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ShareStoryPage() {
  const { status, user } = useAuth();
  const signedIn = status === 'authenticated';
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => ({
    ...EMPTY,
    ...storage.get<Partial<Draft>>(DRAFT_KEY, {}),
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const submit = useSubmitStory();
  const mine = useMyStories(signedIn);

  useEffect(() => {
    if (!submit.isSuccess) storage.set(DRAFT_KEY, draft);
  }, [draft, submit.isSuccess]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const payload = useMemo(
    () => ({
      ...draft,
      mood: draft.mood ?? undefined,
      contactEmail: draft.contactEmail.trim() || undefined,
      consent: draft.consent || undefined,
    }),
    [draft],
  );

  /** Validates only the fields that belong to the current step. */
  const checkStep = (index: number): boolean => {
    const result = validate(submitStoryInput, payload);
    if (result.ok) {
      setErrors({});
      return true;
    }
    const relevant = Object.fromEntries(
      STEP_FIELDS[index]!.map((field) => [field, result.errors[field]]),
    );
    setErrors(relevant);
    return Object.values(relevant).every((message) => !message);
  };

  const next = () => checkStep(step) && setStep((value) => Math.min(value + 1, STEPS.length - 1));

  const send = () => {
    const result = validate(submitStoryInput, payload);
    if (!result.ok) {
      setErrors(result.errors);
      const firstBad = STEP_FIELDS.findIndex((fields) =>
        fields.some((field) => result.errors[field]),
      );
      if (firstBad >= 0) setStep(firstBad);
      return;
    }
    submit.mutate(result.data, {
      onSuccess: () => {
        storage.set(DRAFT_KEY, EMPTY);
        setDraft(EMPTY);
        setStep(0);
      },
      onError: (error) => setErrors(apiFieldErrors(error)),
    });
  };

  const words = wordCount(draft.content);
  const progress = Math.min(1, draft.content.trim().length / LIMITS.storyContent.min);

  if (status === 'loading') return null;

  return (
    <div className="mx-auto max-w-3xl">
      <SectionTitle eyebrow="Write to me" title="Share your own story">
        Not everyone wants to go live, but everyone has a page in them. Send yours and, if it fits,
        I will publish it among the other diaries.
      </SectionTitle>

      {!signedIn ? (
        <Paper tilt={-0.5} className="px-6 py-10 text-center sm:px-12">
          <Tape className="-top-3 left-1/2 -translate-x-1/2 rotate-2" />
          <p className="font-hand text-4xl">First, a reader card</p>
          <p className="mx-auto mt-3 max-w-md italic text-ink-soft">
            So I can reply and let you know when your story is published, please sign in or make a
            free account. It takes ten seconds.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <ButtonLink to="/login?next=/share-your-story">Sign in</ButtonLink>
            <ButtonLink to="/signup?next=/share-your-story" variant="paper">
              Create one
            </ButtonLink>
          </div>
        </Paper>
      ) : submit.isSuccess ? (
        <motion.div
          initial={{ opacity: 0, y: 30, rotate: -3 }}
          animate={{ opacity: 1, y: 0, rotate: -1 }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        >
          <Paper className="px-6 py-12 text-center sm:px-12">
            <motion.p
              initial={{ scale: 0.4, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring' }}
              className="text-6xl"
              aria-hidden
            >
              ✉️
            </motion.p>
            <p className="mt-4 font-hand text-5xl">Your story is in the post.</p>
            <p className="mx-auto mt-3 max-w-md italic text-ink-soft">
              Thank you for trusting me with it. I read every letter myself, and you will hear back
              by email either way.
            </p>
            <Button variant="paper" className="mt-8" onClick={() => submit.reset()}>
              Write another
            </Button>
          </Paper>
        </motion.div>
      ) : (
        <Paper className="overflow-hidden">
          {/* Step tabs, like torn index tabs at the top of a notebook */}
          <ol className="flex border-b border-dashed border-ink/15">
            {STEPS.map((label, index) => (
              <li key={label} className="flex-1">
                <button
                  type="button"
                  onClick={() => (index < step || checkStep(step)) && setStep(index)}
                  className={cn(
                    'flex w-full flex-col items-center gap-0.5 px-2 py-3 transition-colors',
                    index === step
                      ? 'bg-paper-deep/70 text-ink'
                      : index < step
                        ? 'text-moss'
                        : 'text-ink-faded hover:text-ink',
                  )}
                  aria-current={index === step ? 'step' : undefined}
                >
                  <span className="font-type text-[0.62rem] uppercase tracking-widest">
                    Step {index + 1}
                  </span>
                  <span className="font-hand text-xl leading-none">{label}</span>
                </button>
              </li>
            ))}
          </ol>

          <div className="px-5 py-8 sm:px-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-6"
              >
                {step === 0 && (
                  <>
                    <p className="font-hand text-3xl">How does this story feel?</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {STORY_MOODS.map((mood) => (
                        <button
                          key={mood}
                          type="button"
                          aria-pressed={draft.mood === mood}
                          onClick={() => set('mood', draft.mood === mood ? null : mood)}
                          className={cn(
                            'flex flex-col items-center gap-1 rounded-[4px] border px-3 py-4 transition-all duration-200',
                            draft.mood === mood
                              ? '-rotate-1 border-quill/60 bg-quill/8 shadow-md'
                              : 'border-ink/15 bg-paper/50 hover:-translate-y-1 hover:border-ink/35 hover:shadow',
                          )}
                        >
                          <span className="text-3xl" aria-hidden>
                            {MOODS[mood].emoji}
                          </span>
                          <span className="font-hand text-2xl">{MOODS[mood].label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-sm italic text-ink-faded">
                      Optional: it helps me read your story in the right light.
                    </p>
                  </>
                )}

                {step === 1 && (
                  <>
                    <TextField
                      label="Give it a title"
                      value={draft.title}
                      maxLength={LIMITS.storyTitle.max}
                      onChange={(event) => set('title', event.target.value)}
                      placeholder="The summer I learned to swim"
                      error={errors.title}
                      className="font-hand text-3xl"
                    />
                    <TextArea
                      label="In a few lines, what is it about?"
                      value={draft.pitch}
                      maxLength={LIMITS.storyPitch.max}
                      onChange={(event) => set('pitch', event.target.value)}
                      rows={3}
                      error={errors.pitch}
                      hint={`${draft.pitch.length}/${LIMITS.storyPitch.max}`}
                    />
                  </>
                )}

                {step === 2 && (
                  <>
                    {draft.mood && (
                      <p className="rounded border-l-4 border-margin bg-paper-deep/50 px-4 py-2 font-hand text-2xl text-quill">
                        {MOODS[draft.mood].emoji} {MOODS[draft.mood].prompt}
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="story-content"
                        className="font-hand text-[1.45rem] leading-none text-ink-soft"
                      >
                        Your story
                      </label>
                      <textarea
                        id="story-content"
                        value={draft.content}
                        onChange={(event) => set('content', event.target.value)}
                        maxLength={LIMITS.storyContent.max}
                        rows={14}
                        aria-invalid={errors.content ? true : undefined}
                        placeholder="Begin anywhere. The middle is fine."
                        className="paper-ruled min-h-80 w-full resize-y rounded-[3px] border border-ink/15 pl-[3rem] pr-4 font-serif text-[1.15rem] leading-[var(--rule)] text-ink [--margin-x:2.25rem] focus:border-quill/50 focus:outline-none"
                      />
                      <div className="flex items-center gap-3">
                        <div
                          className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10"
                          aria-hidden
                        >
                          <div
                            className="h-full rounded-full bg-quill transition-all duration-500"
                            style={{ width: `${progress * 100}%` }}
                          />
                        </div>
                        <span className="font-type text-xs text-ink-faded">{words} words</span>
                      </div>
                      {errors.content && (
                        <p className="text-sm italic text-wax">{errors.content}</p>
                      )}
                      <p className="text-xs italic text-ink-faded">
                        Your draft is saved on this device as you write. Markdown works too.
                      </p>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <div className="rounded-[4px] border border-dashed border-ink/25 bg-paper-deep/40 p-5">
                      <p className="font-type text-[0.65rem] uppercase tracking-widest text-ink-faded">
                        Preview
                      </p>
                      <p className="mt-1 font-hand text-3xl leading-tight">
                        {draft.title || 'Untitled'}
                      </p>
                      <p className="italic text-ink-soft">{draft.pitch}</p>
                      <p className="mt-2 text-sm text-ink-faded">
                        by {draft.isAnonymous ? 'Anonymous' : user?.displayName} · {words} words
                      </p>
                    </div>
                    <Checkbox
                      checked={draft.isAnonymous}
                      onChange={(value) => set('isAnonymous', value)}
                      label="Publish anonymously"
                      description="Your name will not appear anywhere on the story."
                    />
                    <TextField
                      label="Where should I reply?"
                      type="email"
                      value={draft.contactEmail}
                      onChange={(event) => set('contactEmail', event.target.value)}
                      placeholder={user?.email}
                      hint="Leave blank to use the email on your reader card."
                      error={errors.contactEmail}
                    />
                    <Checkbox
                      checked={draft.consent}
                      onChange={(value) => set('consent', value)}
                      label="I wrote this, and I'm happy for it to be published on Livelog"
                      description="I may lightly edit for typos. You can ask me to take it down at any time."
                    />
                    {errors.consent && (
                      <p className="-mt-3 text-sm italic text-wax">{errors.consent}</p>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex items-center justify-between gap-3 border-t border-dashed border-ink/15 pt-6">
              <Button
                variant="ghost"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                disabled={step === 0}
                icon={<ArrowLeft className="size-4" />}
              >
                Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button onClick={next} icon={<ArrowRight className="size-4" />}>
                  Continue
                </Button>
              ) : (
                <Button
                  variant="wax"
                  onClick={send}
                  loading={submit.isPending}
                  icon={<Send className="size-4" />}
                >
                  Send my story
                </Button>
              )}
            </div>
          </div>
        </Paper>
      )}

      {signedIn && <MyLetters stories={mine.data ?? []} />}
    </div>
  );
}
