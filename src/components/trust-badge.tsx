import { CheckCircle, ShieldCheck, Sparkle } from "@phosphor-icons/react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { TrustScore } from "@/lib/types"

const INACTIVE_DAYS = 60

type Side = "creator" | "clipper"
type Variant = "hub-card" | "detail" | "inbox-row"

interface Props {
  trust: TrustScore | null | undefined
  side: Side
  variant: Variant
  className?: string
}

function formatPct(rate: number | null): string {
  if (rate === null) return "—"
  return `${Math.round(rate * 100)}%`
}

function isInactive(trust: TrustScore): boolean {
  if (!trust.lastPayoutAt) return false
  const last = new Date(trust.lastPayoutAt).getTime()
  return Date.now() - last > INACTIVE_DAYS * 24 * 60 * 60 * 1000
}

export function TrustBadge({ trust, side, variant, className }: Props) {
  // No trust object at all → tiny "New …" badge
  const isNew = !trust || (
    side === "creator"
      ? trust.allTime.creatorVerifiedCount === 0
      : trust.allTime.clipperDecidedCount === 0 &&
        trust.allTime.clipperPaidCount === 0
  )

  if (isNew) {
    return (
      <NewBadge
        label={side === "creator" ? "New creator" : "New clipper"}
        variant={variant}
        className={className}
      />
    )
  }

  const t = trust!
  if (side === "creator") {
    const paid = t.allTime.creatorPaidCount
    const verified = t.allTime.creatorVerifiedCount
    const rate = t.allTime.creatorPaidRate
    const paid90 = t.ninetyDay.creatorPaidCount
    const verified90 = t.ninetyDay.creatorVerifiedCount
    const rate90 = t.ninetyDay.creatorPaidRate
    const inactive = isInactive(t)

    if (variant === "hub-card") {
      // All-time only on campaign cards (CC1 D2 / M3.2)
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success",
            className,
          )}
          title={`${paid}/${verified} paid · all-time`}
        >
          <ShieldCheck weight="fill" className="size-3" />
          {formatPct(rate)} · {paid} paid
        </span>
      )
    }

    if (variant === "detail") {
      // Both windows + inactive flag (M3.4)
      return (
        <div className={cn("flex flex-wrap items-center gap-2", className)}>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success">
            <ShieldCheck weight="fill" className="size-3.5" />
            {formatPct(rate)} payout rate · {paid} paid (all-time)
          </span>
          {verified90 > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/70 px-2 py-1 text-[11px] text-muted-foreground">
              {formatPct(rate90)} · {paid90} paid · last 90 days
            </span>
          ) : inactive ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-[11px] text-warning">
              Inactive 60d
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/70 px-2 py-1 text-[11px] text-muted-foreground">
              No payouts last 90 days
            </span>
          )}
        </div>
      )
    }

    // creator side, inbox-row variant: shouldn't appear (creator doesn't see
    // their own trust score in the inbox), but render compact to be safe.
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
          className,
        )}
      >
        <ShieldCheck className="size-3" />
        {formatPct(rate)} · {paid}
      </span>
    )
  }

  // ── Clipper side ──────────────────────────────────────────────────
  const score = t.allTime.clipperScore
  const approved = t.allTime.clipperApprovedCount
  const decided = t.allTime.clipperDecidedCount
  const disputed = t.allTime.clipperDisputedCount
  const paidPayouts = t.allTime.clipperPaidCount

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
              className,
            )}
          >
            <Sparkle weight="fill" className="size-3 text-primary" />
            {score === null ? "—" : formatPct(score)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">
            <p>
              {approved}/{decided} approved
              {paidPayouts > 0 && ` · ${disputed} disputed of ${paidPayouts} paid`}
            </p>
            <p className="mt-1 text-muted-foreground">
              All-time clipper trust score (approval rate × dispute-free rate)
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function NewBadge({
  label,
  variant,
  className,
}: {
  label: string
  variant: Variant
  className?: string
}) {
  if (variant === "detail") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-medium text-primary",
          className,
        )}
      >
        <CheckCircle weight="fill" className="size-3" />
        {label} — no reviews yet
      </span>
    )
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary",
        className,
      )}
    >
      <Sparkle weight="fill" className="size-3" />
      {label}
    </span>
  )
}
