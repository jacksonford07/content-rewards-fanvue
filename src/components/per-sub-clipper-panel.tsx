import { useState, type ReactElement } from "react"
import { Link } from "react-router-dom"
import {
  CheckCircle,
  Copy,
  CursorClick,
  CurrencyDollar,
  Hourglass,
  Info,
  LinkSimple,
  Prohibit,
  Scroll,
  Users,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { track } from "@/lib/analytics"
import { formatCurrency } from "@/lib/mock-data"
import type { Campaign, Submission } from "@/lib/types"

interface Props {
  campaign: Campaign
  myClips: Submission[]
  hasMethodOverlap: boolean
  missingMethodsHint: string | null
  isBannedFromCampaign: boolean
  budgetRemaining: number
  applying: boolean
  onApply: () => void
}

// M4.2 — clipper-side panel for per-subscriber campaigns. Replaces the
// "Submit my clip" CTA with an Apply button (no clip URL required) and,
// once applied, surfaces the minted tracking link + accrual progress.
export function PerSubClipperPanel({
  campaign,
  myClips,
  hasMethodOverlap,
  missingMethodsHint,
  isBannedFromCampaign,
  budgetRemaining,
  applying,
  onApply,
}: Props) {
  const application = myClips[0]
  const [copied, setCopied] = useState(false)
  // v1.2 M2.11 — pre-apply anti-bot acknowledgement. Page-local: not
  // persisted on the submission yet. If we need an audit trail later,
  // store as `submissions.acknowledged_anti_bot_at` on apply.
  const [acknowledgedAntiBot, setAcknowledgedAntiBot] = useState(false)

  const ended =
    campaign.status === "completed" ||
    (campaign.endsAt ? new Date(campaign.endsAt).getTime() < Date.now() : false)
  const paused = campaign.status === "paused"
  const noBudget = budgetRemaining <= 0
  const isManual = campaign.applicationMode === "manual"

  const canApply =
    !application &&
    !isBannedFromCampaign &&
    hasMethodOverlap &&
    !ended &&
    !paused &&
    !noBudget

  if (application) {
    return (
      <div className="mt-6 space-y-3">
        <ApplicationStatusBadge status={application.status} />

        {/* Bug K: hide the tracking link for revoked / rejected submissions
            — the link is gone on Fanvue's side, showing it here is
            misleading. */}
        {(application.status === "revoked" ||
          application.status === "rejected") ? null : application.trackingLinkUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <LinkSimple className="size-4" weight="bold" />
              Your tracking link
            </div>
            <div className="flex gap-2">
              <Input
                readOnly
                value={application.trackingLinkUrl}
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    application.trackingLinkUrl ?? "",
                  )
                  setCopied(true)
                  toast.success("Link copied")
                  // v1.2 M4 — PRD §S5 event
                  track("tracking_link_copied", {
                    submission_id: application.id,
                    campaign_id: application.campaignId,
                  })
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                {copied ? (
                  <CheckCircle className="size-4" weight="fill" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Paste this link in your post bio or description. Subscribers
              acquired through it accrue toward your payout.
            </p>
          </div>
        ) : isManual && application.status === "pending" ? (
          <Alert className="border-warning/40 bg-warning/5">
            <Hourglass className="size-4 text-warning" />
            <AlertTitle>Awaiting creator review</AlertTitle>
            <AlertDescription>
              The creator has 24 hours to approve. If they don't respond,
              your application will be auto-rejected.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* v1.2 M2.4 + M2.6 — three-card stat row: clicks, acquired subs,
            estimated earnings. "subs" replaces "views" labelling per
            sync (M2.6). */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <CursorClick className="size-3" weight="bold" />
              Clicks
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {(application.lastClicks ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Users className="size-3" weight="bold" />
              Subs acquired
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {(application.lastAcquiredSubs ?? 0).toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              <CurrencyDollar className="size-3" weight="bold" />
              Earnings
            </div>
            <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
              {formatCurrency(application.pendingEarnings ?? 0)}
            </p>
          </div>
        </div>

        {/* v1.2 M2.4 — traffic rules. Plain whitespace-preserving render
            (no markdown lib in the bundle). Creators set this on campaign
            create / edit; falls through to nothing if blank. */}
        {campaign.trafficRules ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <Scroll className="size-3.5" weight="bold" />
              Traffic rules
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
              {campaign.trafficRules}
            </p>
          </div>
        ) : null}

        <p className="text-center text-[11px] text-muted-foreground">
          Settles {campaign.endsAt
            ? `on ${new Date(campaign.endsAt).toLocaleDateString()}`
            : "when the creator closes the campaign"}
          {" "}or earlier if budget caps out.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* v1.2 M2.11 — anti-bot acknowledgement gate. Required to apply.
          Pure UX gate; not persisted on the submission record yet. */}
      <label className="mt-6 flex cursor-pointer items-start gap-2.5 rounded-md border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed">
        <Checkbox
          checked={acknowledgedAntiBot}
          onCheckedChange={(v) => setAcknowledgedAntiBot(v === true)}
          className="mt-0.5"
        />
        <span>
          I won't drive this campaign with bots, click farms, or other
          artificial traffic. I understand violations may result in losing
          accrued earnings and being banned from this campaign and the
          platform.
        </span>
      </label>
      {!hasMethodOverlap && missingMethodsHint && (
        <Alert className="mt-6 border-warning/40 bg-warning/5">
          <Info className="size-4 text-warning" />
          <AlertTitle>You can't apply yet</AlertTitle>
          <AlertDescription>
            This creator pays in <strong>{missingMethodsHint}</strong>. Add one
            of these to your{" "}
            <Link
              to="/settings/payout"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              payout settings
            </Link>{" "}
            to apply.
          </AlertDescription>
        </Alert>
      )}
      <Button
        className="mt-3 w-full"
        size="lg"
        disabled={!canApply || applying || !acknowledgedAntiBot}
        onClick={onApply}
      >
        {isBannedFromCampaign ? (
          <Prohibit className="size-4" weight="bold" />
        ) : (
          <Users className="size-4" weight="bold" />
        )}
        {isBannedFromCampaign
          ? "You're banned"
          : ended
            ? "Campaign ended"
            : paused
              ? "Campaign paused"
              : noBudget
                ? "Budget exhausted"
                : applying
                  ? "Applying…"
                  : isManual
                    ? "Apply for review"
                    : "Apply & get tracking link"}
      </Button>
      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        {isManual
          ? "Creator has 24h to approve — auto-rejects on timeout."
          : "Tracking link is minted instantly. Accrual stops at the campaign end date."}
      </p>
    </>
  )
}

function ApplicationStatusBadge({ status }: { status: string }) {
  const map: Record<
    string,
    { label: string; className: string; icon: ReactElement }
  > = {
    pending: {
      label: "Awaiting approval",
      className: "border-warning/40 bg-warning/5 text-warning",
      icon: <Hourglass className="size-4" weight="bold" />,
    },
    approved: {
      label: "Approved · accruing",
      className: "border-success/40 bg-success/5 text-success",
      icon: <CheckCircle className="size-4" weight="fill" />,
    },
    auto_approved: {
      label: "Approved · accruing",
      className: "border-success/40 bg-success/5 text-success",
      icon: <CheckCircle className="size-4" weight="fill" />,
    },
    ready_to_pay: {
      label: "Ready to pay",
      className: "border-primary/40 bg-primary/5 text-primary",
      icon: <CheckCircle className="size-4" weight="fill" />,
    },
    paid_off_platform: {
      label: "Paid",
      className: "border-success/40 bg-success/5 text-success",
      icon: <CheckCircle className="size-4" weight="fill" />,
    },
    rejected: {
      label: "Application rejected",
      className: "border-destructive/40 bg-destructive/5 text-destructive",
      icon: <Prohibit className="size-4" weight="bold" />,
    },
    disputed: {
      label: "Disputed",
      className: "border-destructive/40 bg-destructive/5 text-destructive",
      icon: <Info className="size-4" weight="bold" />,
    },
  }
  const meta = map[status] ?? {
    label: status,
    className: "border-border/60 bg-muted/30 text-muted-foreground",
    icon: <Info className="size-4" />,
  }
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${meta.className}`}
    >
      {meta.icon}
      {meta.label}
    </div>
  )
}
