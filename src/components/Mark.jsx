// Six rotated ellipses: a tiny guilloche rosette used as the logo.
export default function Mark({ size = 28 }) {
  return (
    <svg
      className="mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      focusable="false"
    >
      {[0, 30, 60, 90, 120, 150].map((angle) => (
        <ellipse key={angle} cx="32" cy="32" rx="28" ry="10.5" transform={`rotate(${angle} 32 32)`} />
      ))}
    </svg>
  );
}
