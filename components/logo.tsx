/**
 * Three ascending bars whose tallest is an "f" — the mark reads as a chart and
 * as the initial at the same time. Pure geometry so it stays crisp at 16px, and
 * `currentColor` so it picks up the accent token in both themes.
 */
export function Logo({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden focusable="false">
      <rect x="1.5" y="13.5" width="4.5" height="8" rx="1.5" fill="currentColor" />
      <rect x="8.25" y="8.5" width="4.5" height="13" rx="1.5" fill="currentColor" />
      <path d="M15 21.5 V6.75 A3.75 3.75 0 0 1 18.75 3 H21.5 V7.5 H15 Z" fill="currentColor" />
      <rect x="15" y="10" width="7" height="4" rx="1.4" fill="currentColor" />
      <rect x="15" y="6" width="4.5" height="15.5" rx="1.5" fill="currentColor" />
    </svg>
  );
}
