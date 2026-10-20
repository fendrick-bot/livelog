import { ButtonLink } from '../components/diary/Button';
import { Paper, Tape } from '../components/diary/Paper';

export default function NotFoundPage() {
  return (
    <Paper
      tilt={-1.2}
      className="mx-auto mt-6 max-w-lg px-8 py-12 text-center [clip-path:polygon(0_2%,6%_0,14%_3%,22%_0,31%_2%,40%_0,52%_3%,61%_0,72%_2%,83%_0,91%_3%,100%_0,100%_100%,0_100%)]"
    >
      <Tape className="-top-1 left-1/2 -translate-x-1/2 rotate-2" />
      <p className="font-type text-xs uppercase tracking-[0.3em] text-ink-faded">Page 404</p>
      <h1 className="mt-3 font-hand text-5xl">This page was torn out.</h1>
      <p className="mt-4 italic text-ink-soft">
        Whatever was written here has gone missing, or perhaps was never written at all.
      </p>
      <ButtonLink to="/" className="mt-8">
        Back to the diary
      </ButtonLink>
    </Paper>
  );
}
