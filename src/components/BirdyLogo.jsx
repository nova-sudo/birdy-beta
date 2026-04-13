import Image from "next/image"

/**
 * Birdy brand logo.
 *
 * Props:
 *   variant: "icon" | "lockup" | "wordmark"   (default: "icon")
 *   theme:   "light" | "dark" | "badge"       ("badge" only with variant="icon")
 *   size:    number — pixel height (defaults per variant)
 *   className, priority
 */
const ASSETS = {
  icon: {
    light: { src: "/brand/icon-light.png", ratio: 1 },
    dark: { src: "/brand/icon-dark.png", ratio: 1 },
    badge: { src: "/brand/icon-badge.png", ratio: 1 },
  },
  lockup: {
    light: { src: "/brand/logo-light.png", ratio: 2 },
    dark: { src: "/brand/logo-dark.png", ratio: 2 },
  },
  wordmark: {
    light: { src: "/brand/wordmark-light.png", ratio: 3 },
    dark: { src: "/brand/wordmark-dark.png", ratio: 3 },
  },
}

const DEFAULT_HEIGHT = {
  icon: 32,
  lockup: 40,
  wordmark: 32,
}

export default function BirdyLogo({
  variant = "icon",
  theme = "light",
  size,
  className = "",
  priority = false,
  animate = true,
}) {
  const group = ASSETS[variant] || ASSETS.icon
  const entry = group[theme] || group.light
  const height = size ?? DEFAULT_HEIGHT[variant]
  const width = Math.round(height * entry.ratio)

  const wrapperClass = animate ? "birdy-flap" : ""

  return (
    <span className={wrapperClass} style={{ lineHeight: 0 }}>
      <Image
        src={entry.src}
        alt="Birdy"
        width={width}
        height={height}
        priority={priority}
        className={className}
        style={{ height, width: "auto" }}
      />
    </span>
  )
}
