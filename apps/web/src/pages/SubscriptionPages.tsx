import { useEffect, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { useConfirmSubscription, useUnsubscribe } from '../api/subscribers';
import { Button, ButtonLink } from '../components/diary/Button';
import { InkLoader } from '../components/diary/Feedback';
import { Paper, Tape } from '../components/diary/Paper';
import { errorMessage } from '../lib/api';

function Letter({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Paper tilt={-0.7} className="mx-auto mt-6 max-w-lg px-8 py-12 text-center">
      <Tape className="-top-3 left-1/2 -translate-x-1/2 -rotate-2" />
      <h1 className="font-hand text-5xl leading-tight">{title}</h1>
      <div className="mt-4 flex flex-col items-center gap-6 italic text-ink-soft">{children}</div>
    </Paper>
  );
}

export function SubscribeConfirmPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const confirm = useConfirmSubscription();
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    confirm.mutate(token);
  }, [confirm, token]);

  if (!token)
    return (
      <Letter title="This link is missing its token">
        Open the link from your email again, or subscribe once more.
      </Letter>
    );
  if (confirm.isPending || confirm.isIdle)
    return <InkLoader label="Breaking the seal…" className="text-paper/70" />;
  if (confirm.isError) {
    return (
      <Letter title="That seal is broken">
        <p>{errorMessage(confirm.error)}</p>
        <ButtonLink to="/#subscribe">Subscribe again</ButtonLink>
      </Letter>
    );
  }
  return (
    <Letter title="You're on the list">
      <p>{confirm.data?.message}</p>
      <ButtonLink to="/">Back to the diary</ButtonLink>
    </Letter>
  );
}

export function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const unsubscribe = useUnsubscribe();

  if (unsubscribe.isSuccess) {
    return (
      <Letter title="No more letters">
        <p>{unsubscribe.data.message}</p>
        <ButtonLink to="/" variant="paper">
          Back to the diary
        </ButtonLink>
      </Letter>
    );
  }
  return (
    <Letter title="Stop the letters?">
      <p>
        You will no longer get an email when I start writing live. You can always subscribe again
        later.
      </p>
      {unsubscribe.isError && <p className="text-wax">{errorMessage(unsubscribe.error)}</p>}
      <Button
        variant="danger"
        disabled={!token}
        loading={unsubscribe.isPending}
        onClick={() => unsubscribe.mutate(token)}
      >
        Yes, unsubscribe me
      </Button>
    </Letter>
  );
}
