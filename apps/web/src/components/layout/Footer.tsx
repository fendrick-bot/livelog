import { Link } from 'react-router';

export function Footer() {
  return (
    <footer className="mx-auto mt-24 max-w-6xl px-4 pb-12 text-center text-paper/55">
      <svg viewBox="0 0 200 20" className="mx-auto h-5 w-44 text-gold/50" aria-hidden>
        <path
          d="M2 10c30 0 40-8 60-8s20 16 38 16 18-16 38-16 30 8 60 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="100" cy="10" r="2.4" fill="currentColor" />
      </svg>
      <p className="mt-3 font-hand text-3xl text-paper/80">Fin. (for now)</p>
      <nav
        className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm"
        aria-label="Footer"
      >
        <Link className="link-ink hover:text-paper" to="/logs">
          All entries
        </Link>
        <Link className="link-ink hover:text-paper" to="/community">
          Other diaries
        </Link>
        <Link className="link-ink hover:text-paper" to="/share-your-story">
          Share your story
        </Link>
        <Link className="link-ink hover:text-paper" to="/account">
          Reader card
        </Link>
      </nav>
      <p className="mt-6 font-type text-[0.65rem] uppercase tracking-[0.25em]">
        © {new Date().getFullYear()} Livelog · written slowly, read live
      </p>
    </footer>
  );
}
