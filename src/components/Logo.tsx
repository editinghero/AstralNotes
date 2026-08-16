/** The Astral Notes mark — same geometry as the app icon / favicon. */
export function Logo({ className = "size-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      role="img"
      aria-label="Astral Notes"
    >
      <rect
        width="512"
        height="512"
        rx="112"
        fill="currentColor"
        fillOpacity="0.14"
      />
      <path
        d="M186 226v-34a70 70 0 0 1 140 0v34"
        fill="none"
        stroke="currentColor"
        strokeWidth="34"
        strokeLinecap="round"
      />
      <rect
        x="152"
        y="226"
        width="208"
        height="160"
        rx="44"
        fill="currentColor"
      />
      <circle cx="256" cy="292" r="20" className="fill-background" />
      <rect
        x="246"
        y="300"
        width="20"
        height="46"
        rx="10"
        className="fill-background"
      />
    </svg>
  );
}
