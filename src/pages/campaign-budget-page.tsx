import { useMemo, useState } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  CalendarBlank,
  CheckCircle,
  CurrencyDollar,
  Hourglass,
  Info,
  Lightning,
  Lock,
  Stop,
  Users,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/mock-data"
import { useCampaign } from "@/queries/campaigns"
import {
  useApproveSubmission,
  useCloseCampaign,
  useRejectSubmission,
  useSubmissionsByCampaign,
} from "@/queries/submissions"
import { MarkPaidDialog } from "@/components/mark-paid-dialog"
import { NotFoundCard } from "@/components/not-found-card"
import type { Submission } from "@/lib/types"

// v1.1 (M4.2 D7) — extends the budget page with a per-sub Clippers panel.
// Per-views campaigns continue to show only the budget summary; per-sub
// campaigns get the live applicant list with mark-paid hooks.

export function CampaignBudgetPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    data: campaign,
    isLoading: loading,
    isError: campaignError,
  } = useCampaign(id)
  const isPerSub = campaign?.payoutType === "per_subscriber"

  const { data: submissions } = useSubmissionsByCampaign(
    isPerSub ? id : undefined,
  )

  const closeMutation = useCloseCampaign()
  const approveMutation = useApproveSubmission()
  const rejectMutation = useRejectSubmission()

  const [closeOpen, setCloseOpen] = useState(false)
  const [markPaidId, setMarkPaidId] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const rows = submissions ?? []
    const accruing = rows.filter(
      (s) => s.status === "approved" || s.status === "auto_approved",
    )
    const pending = rows.filter((s) => s.status === "pending")
    const ready = rows.filter((s) => s.status === "ready_to_pay")
    const settled = rows.filter(
      (s) => s.status === "paid_off_platform" || s.status === "paid",
    )
    return { accruing, pending, ready, settled }
  }, [submissions])

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <Skeleton className="mb-6 h-4 w-56" />
        <div className="mb-6 space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="border-border/60 bg-card/70 p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-7 w-24" />
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (campaignError || !campaign) {
    return (
      <NotFoundCard
        title="Campaign not found"
        description="This campaign may have been deleted, or the link is outdated."
        backTo="/creator/campaigns"
        backLabel="Back to campaigns"
      />
    )
  }

  if (campaign.status === "draft" || campaign.status === "pending_budget") {
    navigate(`/creator/campaigns/${campaign.id}/edit`, { replace: true })
    return null
  }

  const handleClose = async () => {
    if (!campaign) return
    try {
      await closeMutation.mutateAsync(campaign.id)
      toast.success("Campaign closed", {
        description: "All accruing clippers were rolled to ready-to-pay.",
      })
      setCloseOpen(false)
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error("Couldn't close campaign", {
        description: e.response?.data?.message ?? "Try again in a moment.",
      })
    }
  }

  const totalAccruedCents = (submissions ?? []).reduce(
    (sum, s) => sum + Math.round((s.pendingEarnings ?? 0) * 100),
    0,
  )

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex items-center justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/creator/campaigns">My campaigns</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  to={`/creator/campaigns/${campaign.id}`}
                  className="max-w-[180px] truncate"
                >
                  {campaign.title}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Budget</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/creator/campaigns">
            <ArrowLeft className="size-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Budget
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {campaign.title} —{" "}
            {isPerSub
              ? "live clipper progress and off-platform payouts."
              : "declared budget and payout history."}
          </p>
        </div>
        {isPerSub && campaign.status === "active" && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setCloseOpen(true)}
          >
            <Stop className="size-4" weight="fill" />
            Close campaign
          </Button>
        )}
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" weight="fill" />
        <p>
          Payouts happen off-platform — you mark each clipper paid here once
          you've sent them money via PayPal, crypto, bank transfer, or
          whichever method you've agreed on.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/70 p-4 backdrop-blur">
          <div className="flex items-center gap-2 text-primary">
            <CurrencyDollar className="size-4" weight="fill" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Declared budget
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {formatCurrency(campaign.totalBudget)}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Spent: {formatCurrency(campaign.budgetSpent)}
          </p>
        </Card>
        <Card className="border-border/60 bg-card/70 p-4 backdrop-blur">
          <div className="flex items-center gap-2 text-success">
            <Lightning className="size-4" weight="fill" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Status
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold capitalize">
            {campaign.status}
          </p>
          {campaign.isPrivate && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Lock className="size-3" weight="fill" /> Private campaign
            </p>
          )}
        </Card>
        {isPerSub ? (
          <Card className="border-border/60 bg-card/70 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-warning">
              <CalendarBlank className="size-4" weight="fill" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Ends
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {campaign.endsAt
                ? new Date(campaign.endsAt).toLocaleDateString()
                : "—"}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Accrued so far: {formatCurrency(totalAccruedCents / 100)}
            </p>
          </Card>
        ) : (
          <Card className="border-border/60 bg-card/70 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-4" weight="fill" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Clippers
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums">
              {campaign.activeClippers}
            </p>
          </Card>
        )}
      </div>

      {isPerSub ? (
        <div className="space-y-4">
          {grouped.pending.length > 0 && (
            <ClipperSection
              title="Awaiting your approval"
              hint="24h auto-rejects on timeout."
              icon={<Hourglass className="size-4" />}
              rows={grouped.pending}
              actions={(s) => (
                <>
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await approveMutation.mutateAsync(s.id)
                        toast.success("Approved")
                      } catch {
                        toast.error("Couldn't approve")
                      }
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await rejectMutation.mutateAsync({
                          id: s.id,
                          reason: "Not a fit",
                        })
                        toast.success("Rejected")
                      } catch {
                        toast.error("Couldn't reject")
                      }
                    }}
                  >
                    Reject
                  </Button>
                </>
              )}
            />
          )}
          {grouped.accruing.length > 0 && (
            <ClipperSection
              title="Accruing"
              hint="Sub + click deltas land every 30 min via the attribution cron."
              icon={<Lightning className="size-4" />}
              rows={grouped.accruing}
            />
          )}
          {grouped.ready.length > 0 && (
            <ClipperSection
              title="Ready to pay"
              icon={<CheckCircle className="size-4" />}
              rows={grouped.ready}
              actions={(s) => (
                <Button size="sm" onClick={() => setMarkPaidId(s.id)}>
                  Mark paid
                </Button>
              )}
            />
          )}
          {grouped.settled.length > 0 && (
            <ClipperSection
              title="Paid"
              icon={<CheckCircle className="size-4" />}
              rows={grouped.settled}
            />
          )}
          {(submissions?.length ?? 0) === 0 && (
            <Card className="border-border/60 bg-card/70 backdrop-blur">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No clippers have applied yet. Share your campaign link to
                attract applicants.
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Off-platform payout history will appear here in v1.1 (M2).
          </CardContent>
        </Card>
      )}

      <AlertDialog open={closeOpen} onOpenChange={setCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              All accruing clippers will be rolled to ready-to-pay using their
              accrued earnings. Pending applications will be rejected. This
              can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClose}
              disabled={closeMutation.isPending}
            >
              {closeMutation.isPending ? "Closing…" : "Close campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MarkPaidDialog
        submissionId={markPaidId}
        open={!!markPaidId}
        onOpenChange={(open) => !open && setMarkPaidId(null)}
      />
    </div>
  )
}

function ClipperSection({
  title,
  hint,
  icon,
  rows,
  actions,
}: {
  title: string
  hint?: string
  icon: React.ReactNode
  rows: Submission[]
  actions?: (s: Submission) => React.ReactNode
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
          <span className="text-muted-foreground">({rows.length})</span>
        </h2>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardContent className="divide-y divide-border/60 p-0">
          {rows.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                {s.fanAvatarUrl ? (
                  <img
                    src={s.fanAvatarUrl}
                    alt=""
                    className="size-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="size-9 rounded-full bg-muted" />
                )}
                <div>
                  <p className="text-sm font-medium">@{s.fanHandle}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {s.trackingLinkSlug ? (
                      <span className="font-mono">{s.trackingLinkSlug}</span>
                    ) : (
                      "no link yet"
                    )}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Stat
                  label="Clicks"
                  value={(s.lastClicks ?? 0).toLocaleString()}
                />
                <Stat
                  label="Subs"
                  value={(s.lastAcquiredSubs ?? 0).toLocaleString()}
                />
                <Stat
                  label="Earnings"
                  value={formatCurrency(s.pendingEarnings ?? 0)}
                  emphasis
                />
                {actions && (
                  <div className="flex gap-2">{actions(s)}</div>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-sm font-semibold tabular-nums ${
          emphasis ? "text-primary" : ""
        }`}
      >
        {value}
      </p>
    </div>
  )
}
