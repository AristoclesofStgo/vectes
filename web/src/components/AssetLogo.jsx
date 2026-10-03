// Round logo for each Vectes asset. Crypto marks come from cryptocurrency-icons (CC0),
// currency flags from flag-icons (MIT); metals, energy and indices use Vectes badges.
// Small SVGs are inlined by Vite, so the whole set costs no extra requests.
const LOGOS = import.meta.glob('../assets/logos/*.svg', { eager: true, query: '?url', import: 'default' })
const byId = Object.fromEntries(Object.entries(LOGOS).map(([path, url]) => [path.match(/([A-Z]+)\.svg$/)[1], url]))

export default function AssetLogo({ id, size = 20 }) {
  const src = byId[id]
  if (!src) return <span className="asset-logo placeholder" style={{ width: size, height: size }} aria-hidden="true" />
  return <img className="asset-logo" src={src} width={size} height={size} alt="" aria-hidden="true" loading="lazy" decoding="async" />
}
