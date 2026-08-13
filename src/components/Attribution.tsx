/**
 * TMDB attribution.
 *
 * Not decoration — TMDB's terms require it: "Please ensure you attribute TMDB
 * for any images or data you use." Since posters, availability, genres and
 * runtimes all come from them, this has to be visible in the product, not
 * buried in a README.
 *
 * Rendered once at the bottom of the Tonight screen, deliberately quiet.
 */
export function Attribution() {
  return (
    <footer className="mt-8 space-y-1.5 pb-4 text-center">
      <p className="text-[11.5px] leading-relaxed text-ink-3">
        Metadata, posters and streaming availability from{' '}
        <a
          href="https://www.themoviedb.org"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block py-1 underline underline-offset-2"
        >
          TMDB
        </a>
        . Ratings from{' '}
        <a
          href="https://www.omdbapi.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block py-1 underline underline-offset-2"
        >
          OMDb
        </a>
        .
      </p>
      <p className="text-[11px] leading-relaxed text-ink-3/80">
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>
    </footer>
  );
}
