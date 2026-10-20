import { isRouteErrorResponse, useRouteError } from 'react-router';
import { ButtonLink } from '../components/diary/Button';
import { Paper } from '../components/diary/Paper';

export default function ErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Something unexpected happened.';
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Paper tilt={1} className="max-w-lg px-8 py-12 text-center">
        <p className="font-hand text-5xl">An ink spill</p>
        <p className="mt-4 italic text-ink-soft">{message}</p>
        <ButtonLink to="/" className="mt-8" reloadDocument>
          Start over
        </ButtonLink>
      </Paper>
    </div>
  );
}
