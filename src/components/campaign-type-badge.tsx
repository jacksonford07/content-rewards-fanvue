import { Scissors, UserPlus } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

interface CampaignTypeBadgeProps {
  payoutType: "per_1k_views" | "per_subscriber"
  className?: string
  size?: "sm" | "md"
}

export function CampaignTypeBadge({
  payoutType,
  className,
  size = "sm",
}: CampaignTypeBadgeProps) {
  const isPerSub = payoutType === "per_subscriber"
  const Icon = isPerSub ? UserPlus : Scissors
  const label = isPerSub ? "Subscriber" : "Clip"
  const sizes =
    size === "md"
      ? "px-2.5 py-1 text-xs gap-1.5"
      : "px-2 py-0.5 text-[11px] gap-1"
  const iconSize = size === "md" ? "size-3.5" : "size-3"

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        isPerSub
          ? "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30"
          : "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
        sizes,
        className,
      )}
    >
      <Icon className={iconSize} weight="fill" aria-hidden />
      {label}
    </span>
  )
}
