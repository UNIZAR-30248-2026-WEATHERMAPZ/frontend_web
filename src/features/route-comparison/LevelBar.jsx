// A bar of three steps for «Poco / Algo / Mucho» (PBI-19): no numbers, and the words go next to it,
// so it does not depend on colour. The bar itself is decorative for screen readers.
export function LevelBar({ level }) {
  return (
    <span className={`level-bar level-bar-${level}`} aria-hidden="true">
      {[1, 2, 3].map((step) => (
        <span key={step} className={step <= level ? 'is-on' : ''} />
      ))}
    </span>
  );
}
