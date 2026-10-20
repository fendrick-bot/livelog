import { loginInput, signupInput } from '@livelog/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { useLogin, useSignup } from '../api/auth';
import { Button } from '../components/diary/Button';
import { TextField } from '../components/diary/Field';
import { Paper, Tape } from '../components/diary/Paper';
import { errorMessage } from '../lib/api';
import { useAuth } from '../lib/auth';
import { apiFieldErrors, validate, type FieldErrors } from '../lib/form';

/** A library card: the sign-in and sign-up forms share it. */
function LibraryCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md pt-4">
      <Paper tilt={-0.8} className="overflow-hidden">
        <Tape className="-top-3 left-8 -rotate-6" />
        <div className="flex items-center justify-between bg-[#8f2d2d]/90 px-6 py-2 font-type text-[0.65rem] uppercase tracking-[0.3em] text-paper">
          <span>Livelog library</span>
          <span>Reader card</span>
        </div>
        <div className="px-6 pb-8 pt-6 sm:px-9">
          <h1 className="font-hand text-5xl leading-none">{title}</h1>
          <p className="mt-2 italic text-ink-faded">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <div className="border-t border-dashed border-ink/20 px-6 py-4 text-center text-sm text-ink-soft sm:px-9">
          {footer}
        </div>
      </Paper>
    </div>
  );
}

function useAfterAuth() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get('next');
  return (role: string) => {
    const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
    void navigate(safe ?? (role === 'admin' ? '/admin' : '/'), { replace: true });
  };
}

export function LoginPage() {
  const { status } = useAuth();
  const [params] = useSearchParams();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const login = useLogin();
  const done = useAfterAuth();

  // Only bounce visitors who arrive already signed in; a sign-in in progress navigates itself.
  if (status === 'authenticated' && login.isIdle) return <Navigate to="/" replace />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(loginInput, values);
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    login.mutate(result.data, {
      onSuccess: (session) => done(session.user.role),
      onError: (error) => setErrors({ ...apiFieldErrors(error), form: errorMessage(error) }),
    });
  };

  const next = params.get('next');
  return (
    <LibraryCard
      title="Welcome back"
      subtitle="Sign in to leave notes, react, and send your stories."
      footer={
        <>
          New here?{' '}
          <Link
            to={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="link-ink font-semibold text-quill"
          >
            Make a reader card
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(event) => setValues({ ...values, email: event.target.value })}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          error={errors.password}
          onChange={(event) => setValues({ ...values, password: event.target.value })}
        />
        {errors.form && (
          <p
            role="alert"
            className="rounded border border-wax/30 bg-wax/5 px-3 py-2 text-sm italic text-wax"
          >
            {errors.form}
          </p>
        )}
        <Button type="submit" size="lg" loading={login.isPending} className="mt-2">
          Sign in
        </Button>
      </form>
    </LibraryCard>
  );
}

export function SignupPage() {
  const { status } = useAuth();
  const [params] = useSearchParams();
  const [values, setValues] = useState({ displayName: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const signup = useSignup();
  const done = useAfterAuth();

  if (status === 'authenticated' && signup.isIdle) return <Navigate to="/" replace />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validate(signupInput, values);
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    signup.mutate(result.data, {
      onSuccess: (session) => done(session.user.role),
      onError: (error) => setErrors({ ...apiFieldErrors(error), form: errorMessage(error) }),
    });
  };

  const next = params.get('next');
  return (
    <LibraryCard
      title="A new reader card"
      subtitle="Free, forever. It lets you react, write in the margins and share stories."
      footer={
        <>
          Already have one?{' '}
          <Link
            to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="link-ink font-semibold text-quill"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <TextField
          label="What should we call you?"
          autoComplete="nickname"
          value={values.displayName}
          error={errors.displayName}
          onChange={(event) => setValues({ ...values, displayName: event.target.value })}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(event) => setValues({ ...values, email: event.target.value })}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          error={errors.password}
          hint="At least 8 characters."
          onChange={(event) => setValues({ ...values, password: event.target.value })}
        />
        {errors.form && (
          <p
            role="alert"
            className="rounded border border-wax/30 bg-wax/5 px-3 py-2 text-sm italic text-wax"
          >
            {errors.form}
          </p>
        )}
        <Button type="submit" size="lg" loading={signup.isPending} className="mt-2">
          Create my card
        </Button>
      </form>
    </LibraryCard>
  );
}
