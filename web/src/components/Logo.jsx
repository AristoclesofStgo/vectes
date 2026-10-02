// Vector redraw of the Vectes logo. Ink follows the theme; the check stays green.
export function LogoMark({ size = 28 }) {
  return (
    <svg
      className="logo-mark"
      width={size * (465 / 355)}
      height={size}
      viewBox="0 0 465 355"
      aria-hidden="true"
    >
      <polygon fill="var(--logo-ink)" points="0,355 58.5,355 177.5,153.5 224.5,228.5 260,190 207.5,100 151,100" />
      <polygon fill="var(--logo-ink)" points="148.5,240 178.5,191.5 247.5,303.5 381,77.5 337,55 458.5,0 465,133.5 426,105 276,355 217.5,355" />
      <polygon fill="var(--logo-accent)" points="224.5,228.5 350,91.5 246,266.5" />
    </svg>
  )
}

export default function Logo({ size = 28, tagline = false }) {
  return (
    <span className="logo" aria-label="Vectes">
      <LogoMark size={size} />
      <span className="logo-text">
        <span className="logo-word">VECTES</span>
        {tagline && <span className="logo-tagline">Forex &amp; Stock Market Data</span>}
      </span>
    </span>
  )
}
