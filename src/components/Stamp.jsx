// A rubber-stamp confirmation. Plays once when it appears, right after an action succeeds.
export default function Stamp({ label }) {
  return (
    <div className="stamp" role="img" aria-label={label}>
      <span>{label}</span>
    </div>
  );
}
