import type { Platform } from "@/lib/types"
import { cn } from "@/lib/utils"

interface PlatformIconProps {
  platform: Platform
  className?: string
}

export function PlatformIcon({ platform, className }: PlatformIconProps) {
  const base = "inline-block shrink-0"

  if (platform === "tiktok") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn(base, "size-4", className)}
        aria-label="TikTok"
      >
        <path d="M19.321 5.562a5.124 5.124 0 01-3.03-.98 5.138 5.138 0 01-2.061-4.093V.002h-3.294v15.67c0 1.41-.863 2.62-2.093 3.133a3.381 3.381 0 01-2.58 0 3.378 3.378 0 01-2.093-3.133c0-1.867 1.513-3.38 3.38-3.38.357 0 .7.055 1.023.156v-3.36a6.708 6.708 0 00-1.023-.078A6.74 6.74 0 000 15.75a6.74 6.74 0 006.67 6.748A6.74 6.74 0 0013.342 15.75V8.38a8.466 8.466 0 005.98 2.45V7.536a5.087 5.087 0 01-.001 0z" />
      </svg>
    )
  }

  if (platform === "instagram") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(base, "size-4", className)}
        aria-label="Instagram"
      >
        <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn(base, "size-4", className)}
      aria-label="YouTube"
    >
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}
