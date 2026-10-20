import { subscribeInput } from '@livelog/shared';
import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { useSubscribe } from '../api/subscribers';
import { cn } from '../lib/cn';
import { validate } from '../lib/form';
import { Button } from './diary/Button';
import { Paper } from './diary/Paper';

/** An envelope with a wax seal: "write to me when you go live". */
export function SubscribeCard({ className }: { className?: string }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const subscribe = useSubscribe();
  const sealed = subscribe.isSuccess;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(subscribeInput, { email });
    if (!result.ok) {
      setError(result.errors.email);
      return;
    }
    setError(undefined);
    subscribe.mutate(result.data.email);
  };

  return (
    <Paper className={cn('overflow-hidden px-6 pb-7 pt-10 sm:px-10', className)}>
      {/* Envelope flap */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-paper-deep [clip-path:polygon(0_0,100%_0,50%_100%)]"
      />
      <motion.div
        aria-hidden
        className="wax-seal absolute left-1/2 top-10 grid size-12 -translate-x-1/2 place-items-center rounded-full font-hand text-2xl"
        initial={false}
        animate={sealed ? { scale: [1.6, 0.9, 1], rotate: [-20, 6, 0] } : { scale: 1, rotate: 0 }}
        transition={{ duration: 0.55 }}
      >
        L
      </motion.div>

      <div className="relative mt-14 flex flex-col items-center gap-3 text-center">
        <h3 className="font-hand text-4xl leading-tight">Get a letter when I go live</h3>
        <p className="max-w-md italic text-ink-faded">
          One short email the moment I start writing. No newsletters, no noise. Unsubscribe with a
          single click.
        </p>

        {sealed ? (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 max-w-md font-hand text-2xl text-moss"
            role="status"
          >
            {subscribe.data?.message}
          </motion.p>
        ) : (
          <form
            onSubmit={submit}
            className="mt-3 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:items-end"
            noValidate
          >
            <label className="flex-1 text-left">
              <span className="sr-only">Email address</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="your@address.com"
                aria-invalid={error ? true : undefined}
                className="field-input text-center sm:text-left"
              />
              {error && <span className="mt-1 block text-sm italic text-wax">{error}</span>}
            </label>
            <Button type="submit" variant="wax" loading={subscribe.isPending}>
              Seal it
            </Button>
          </form>
        )}
      </div>
    </Paper>
  );
}
