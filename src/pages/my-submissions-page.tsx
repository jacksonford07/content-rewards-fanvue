import { useEffect, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  ArrowSquareOut,
  ChartLineUp,
  Clock,
  CheckCircle,
  XCircle,
  CurrencyDollar,
  Eye,
  Timer,
  Prohibit,
  Warning,
} from "@phosphor-icons/react"

import { ViewTrendDialog } from "@/components/view-trend-dialog"

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { PageHeader } from "@/components/page-header"
import { PlatformIcon } from "@/components/platform-icon"
import {
  formatCompactNumber,
  formatCurrency,
  platformLabels,
  timeAgo,
  timeUntil,
} from "@/lib/mock-data"
import {
  useConfirmPayout,
  useDisputePayout,
  useMySubmissions,
  useMySubmissionsStats,
  type MineTab,
} from "@/queries/submissions"
import { PaginationBar } from "@/components/pagination-bar"
import type { Submission, SubmissionStatus } from "@/lib/types"
import { toast } from "sonner"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

type FilterKey = MineTab

const tabs: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
  { key: "banned", label: "Banned" },
]

const validTabs: FilterKey[] = ["all", "pending", "approved", "paid", "rejected", "banned"]

export function MySubmissionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get("tab") as FilterKey) || "all"
  const [filter, setFilter] = useState<FilterKey>(
    validTabs.includes(initialTab) ? initialTab : "all",
  )

  // Sync filter state when URL tab changes (e.g. notification click)
  useEffect(() => {
    const urlTab = searchParams.get("tab") as FilterKey | null
    if (urlTab && validTabs.includes(urlTab) && urlTab !== filter) {
      setFilter(urlTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Per-tab independent page state
  const [pages, setPages] = useState<Record<FilterKey, number>>({
    all: 1,
    pending: 1,
    approved: 1,
    paid: 1,
    rejected: 1,
    banned: 1,
  })
  const page = pages[filter]
  const setPage = (p: number) => setPages((prev) => ({ ...prev, [filter]: p }))
  const limit = 20

  const { data: stats } = useMySubmissionsStats()
  const { data: resp, isLoading: loading } = useMySubmissions({
    tab: filter,
    page,
    limit,
  })
  const filtered: Submission[] = resp?.data ?? []
  const meta = resp?.meta

  const counts: Record<FilterKey, number> = {
    all: stats?.all ?? 0,
    pending: stats?.pending ?? 0,
    approved: stats?.approved ?? 0,
    paid: stats?.paid ?? 0,
    rejected: stats?.rejected ?? 0,
    banned: stats?.banned ?? 0,
  }

  const handleTabChange = (v: string) => {
    const key = v as FilterKey
    setFilter(key)
    const next = new URLSearchParams(searchParams)
    if (key === "all") next.delete("tab")
    else next.set("tab", key)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Campaigns</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>My submissions</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        title="My submissions"
        description="Track the status of every clip you've submitted."
        className="mb-6"
      />

      <Tabs
        value={filter}
        onValueChange={handleTabChange}
        className="mb-6"
      >
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key} className="gap-1.5">
                {t.label}
                {counts[t.key] > 0 && (
                  <span className="text-[11px] tabular-nums text-muted-foreground">{counts[t.key]}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value={filter} className="mt-6 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-border/60 bg-card/70">
                  <CardContent className="flex items-center gap-4 p-4">
                    <Skeleton className="size-16 shrink-0 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                    <Skeleton className="h-6 w-20" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-sm text-muted-foreground">
                No submissions in this category yet.
              </p>
            </Card>
          ) : (
            filtered.map((s) => <SubmissionRow key={s.id} submission={s} />)
          )}
        </TabsContent>
      </Tabs>

      {meta && (
        <PaginationBar
          page={meta.page}
          limit={meta.limit}
          totalItems={meta.totalItems}
          totalPages={meta.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}

function StatusBadge({
  status,
  isBanned,
  isPerSub,
}: {
  status: SubmissionStatus
  isBanned?: boolean
  isPerSub?: boolean
}) {
  if (isBanned) {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-destructive/40 bg-destructive/10 text-destructive"
      >
        <Prohibit className="size-3" weight="bold" />
        Banned from campaign
      </Badge>
    )
  }
  const map: Record<
    SubmissionStatus,
    { label: string; className: string; icon: React.ReactNode }
  > = {
    pending: {
      label: "Pending review",
      className: "border-warning/40 bg-warning/10 text-warning",
      icon: <Clock className="size-3" weight="fill" />,
    },
    approved: {
      // Bug E: per-sub stays in "accruing" state forever (no view-scrape
      // window) — verifying language doesn't fit the per-sub flow.
      label: isPerSub ? "Approved · accruing" : "Approved · verifying",
      className: "border-success/40 bg-success/10 text-success",
      icon: <CheckCircle className="size-3" weight="fill" />,
    },
    auto_approved: {
      label: isPerSub ? "Approved · accruing" : "Auto-approved",
      className: "border-success/40 bg-success/10 text-success",
      icon: <CheckCircle className="size-3" weight="fill" />,
    },
    paid: {
      label: "Paid",
      className: "border-primary/40 bg-primary/10 text-primary",
      icon: <CurrencyDollar className="size-3" weight="fill" />,
    },
    paid_off_platform: {
      label: "Paid (off-platform)",
      className: "border-primary/40 bg-primary/10 text-primary",
      icon: <CurrencyDollar className="size-3" weight="fill" />,
    },
    ready_to_pay: {
      label: "Ready to pay",
      className: "border-primary/40 bg-primary/10 text-primary",
      icon: <CurrencyDollar className="size-3" weight="fill" />,
    },
    disputed: {
      label: "Disputed",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
      icon: <Prohibit className="size-3" weight="bold" />,
    },
    rejected: {
      label: "Rejected",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
      icon: <XCircle className="size-3" weight="fill" />,
    },
    revoked: {
      label: "Link revoked",
      className: "border-muted/60 bg-muted/30 text-muted-foreground",
      icon: <Prohibit className="size-3" weight="bold" />,
    },
  }
  const s = map[status]
  return (
    <Badge variant="outline" className={`gap-1.5 ${s.className}`}>
      {s.icon}
      {s.label}
    </Badge>
  )
}

function SubmissionRow({ submission }: { submission: Submission }) {
  const [trendOpen, setTrendOpen] = useState(false)
  // Bug E: per-sub submissions are detected by absence of postUrl
  // (per-view requires it; per-sub apply has no clip artefact).
  const isPerSub = submission.postUrl == null
  const isTracking =
    submission.status === "approved" ||
    submission.status === "auto_approved" ||
    submission.status === "pending"
  const showLiveViews =
    isTracking &&
    submission.lastViewCount != null &&
    submission.lastViewCount > 0
  const canShowTrend =
    (showLiveViews || submission.viewsAtDay30 != null) && !submission.isBanned
  return (
    <Card className="overflow-hidden border-border/60 bg-card/70 backdrop-blur transition-colors hover:border-border">
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:p-5">
        {/* Thumbnail */}
        <div className="relative h-24 w-full shrink-0 overflow-hidden rounded-lg bg-muted md:h-20 md:w-32">
          <img
            src={submission.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          <span className="absolute bottom-1 right-1 flex size-6 items-center justify-center rounded-full bg-background/90 backdrop-blur">
            <PlatformIcon platform={submission.platform} className="size-3" />
          </span>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1">
            <Link
              to={`/campaigns/${submission.campaignId}`}
              className="line-clamp-1 text-sm font-semibold transition-colors hover:text-primary"
            >
              {submission.campaignTitle}
            </Link>
            <p className="text-xs text-muted-foreground">
              by {submission.campaignCreator}
              {submission.platform
                ? ` · ${platformLabels[submission.platform]}`
                : ""}
              {submission.platformUsername
                ? ` · @${submission.platformUsername}`
                : ""}{" "}
              · {timeAgo(submission.submittedAt)}
            </p>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <StatusBadge
              status={submission.status}
              isBanned={submission.isBanned}
              isPerSub={isPerSub}
            />
            {submission.status === "pending" && submission.autoApproveAt && (
              <Badge
                variant="outline"
                className="gap-1.5 border-border/70 text-muted-foreground"
              >
                <Timer className="size-3" />
                Auto-approves in {timeUntil(submission.autoApproveAt)}
              </Badge>
            )}
            {isTracking && submission.lockDate && (
              <Badge
                variant="outline"
                className="gap-1.5 border-border/70 text-muted-foreground"
              >
                <Timer className="size-3" />
                Day-30 in {timeUntil(submission.lockDate, true)}
              </Badge>
            )}
            {submission.postDeletedAt && (
              <Badge
                variant="outline"
                className="gap-1.5 border-warning/40 bg-warning/10 text-warning"
              >
                <Warning className="size-3" weight="fill" />
                Post deleted · count frozen
              </Badge>
            )}
          </div>

          {submission.status === "rejected" && submission.rejectionReason && (
            <div className="mt-2 w-fit max-w-full rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
              <span className="font-medium">
                {submission.isBanned ? "Banned — reason:" : "Reason:"}
              </span>{" "}
              {submission.rejectionReason}
            </div>
          )}

          {/* M4.4 — tracking link surface for per-subscriber submissions.
              Bug E: also show a placeholder when per-sub is approved but the
              link hasn't minted yet (auto-approve race or scope-upgrade
              pending). */}
          {submission.trackingLinkUrl ? (
            <TrackingLinkRow
              url={submission.trackingLinkUrl}
              slug={submission.trackingLinkSlug ?? ""}
            />
          ) : isPerSub &&
            (submission.status === "approved" ||
              submission.status === "auto_approved") ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
              <Clock className="size-3.5" weight="fill" />
              <span>
                Awaiting tracking link. The creator may need to grant
                Fanvue tracking-link permission — check back in a few minutes.
              </span>
            </div>
          ) : null}

          {/* M3.5 — clipper confirmation prompt */}
          {submission.payoutEvent &&
            submission.status === "paid_off_platform" &&
            !submission.payoutEvent.confirmedAt &&
            !submission.payoutEvent.disputedAt && (
              <PayoutConfirmPrompt submission={submission} />
            )}
          {submission.payoutEvent?.confirmedAt && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-success">
              <CheckCircle weight="fill" className="size-3.5" />
              You confirmed receipt on{" "}
              {new Date(submission.payoutEvent.confirmedAt).toLocaleDateString()}
            </div>
          )}
          {submission.payoutEvent?.disputedAt &&
            !submission.payoutEvent.disputeResolution && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-warning">
                <Warning weight="fill" className="size-3.5" />
                Dispute under review
              </div>
            )}
        </div>


        {/* Metrics */}
        <div className="flex items-center gap-4 text-sm md:flex-col md:items-end md:gap-1.5">
          {submission.viewsAtDay30 != null ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Eye className="size-3.5" />
              <span className="tabular-nums">
                {formatCompactNumber(submission.viewsAtDay30)}
              </span>
              <span className="text-[11px]">final views</span>
            </div>
          ) : showLiveViews ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Eye className="size-3.5" />
              <span className="tabular-nums">
                {formatCompactNumber(submission.lastViewCount!)}
              </span>
              <span className="text-[11px]">live views</span>
            </div>
          ) : null}
          {submission.status === "paid" && submission.payoutAmount ? (
            <div className="text-lg font-semibold tabular-nums text-primary">
              +{formatCurrency(submission.payoutAmount)}
            </div>
          ) : isTracking && submission.pendingEarnings ? (
            <div className="text-right">
              <div className="text-base font-semibold tabular-nums text-primary">
                {formatCurrency(submission.pendingEarnings)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                earned · paid at day 30
              </div>
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex gap-2 md:ml-2 md:flex-col">
          {canShowTrend && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTrendOpen(true)}
            >
              <ChartLineUp className="size-3.5" />
              Trend
            </Button>
          )}
          {/* Bug E: per-sub submissions have no clip artefact, so the
              "View post" button is meaningless and the href would be a
              dead link. The tracking link is the relevant artifact and
              already renders via TrackingLinkRow above. */}
              {!isPerSub && submission.postUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={submission.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View post
                    <ArrowSquareOut className="size-3.5" />
                  </a>
                </Button>
              )}
        </div>
      </CardContent>
      {canShowTrend && (
        <ViewTrendDialog
          submission={submission}
          open={trendOpen}
          onOpenChange={setTrendOpen}
        />
      )}
    </Card>
  )
}

function TrackingLinkRow({ url, slug }: { url: string; slug: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("Tracking link copied")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't copy")
    }
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
      <span className="text-xs font-medium text-foreground">
        Your Fanvue tracking link
      </span>
      <code className="font-mono text-[11px] text-muted-foreground">{slug}</code>
      <span className="ml-auto flex gap-2">
        <Button size="sm" variant="outline" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ArrowSquareOut className="size-3.5" />
            Open
          </a>
        </Button>
        <Button size="sm" onClick={handleCopy}>
          {copied ? (
            <CheckCircle weight="fill" className="size-3.5" />
          ) : (
            <CurrencyDollar weight="fill" className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </span>
    </div>
  )
}

function PayoutConfirmPrompt({ submission }: { submission: Submission }) {
  const confirm = useConfirmPayout()
  const dispute = useDisputePayout()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [disputeReason, setDisputeReason] = useState("")
  const event = submission.payoutEvent
  if (!event) return null

  const handleConfirm = async () => {
    try {
      await confirm.mutateAsync(submission.id)
      toast.success("Confirmed receipt", {
        description: "Trust score updated.",
      })
      setConfirmOpen(false)
    } catch {
      toast.error("Couldn't confirm")
    }
  }

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      toast.error("Add a short reason for the dispute")
      return
    }
    try {
      await dispute.mutateAsync({
        id: submission.id,
        reason: disputeReason.trim(),
      })
      toast.success("Dispute raised", {
        description: "Jackson will review this within a few days.",
      })
      setDisputeOpen(false)
      setDisputeReason("")
    } catch {
      toast.error("Couldn't raise dispute")
    }
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
        <span className="text-xs font-medium text-foreground">
          Did you receive {formatCurrency(event.amountCents / 100)} via{" "}
          {event.method}?
        </span>
        <span className="ml-auto flex gap-2">
          <Button size="sm" onClick={() => setConfirmOpen(true)}>
            <CheckCircle weight="fill" className="size-3.5" />
            Yes, received
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDisputeOpen(true)}
          >
            <Warning weight="fill" className="size-3.5" />
            Dispute
          </Button>
        </span>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm payment received?</AlertDialogTitle>
            <AlertDialogDescription>
              You're confirming you received {formatCurrency(event.amountCents / 100)}{" "}
              from this campaign's creator. This counts toward their trust score.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirm.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirm()
              }}
              disabled={confirm.isPending}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise a dispute</DialogTitle>
            <DialogDescription>
              Use this if the payment didn't arrive, the amount was wrong, or
              the wallet address didn't match what you saved. The campaign
              owner is notified and a human reviewer follows up.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dispute-reason" className="text-xs">
              What went wrong?
            </Label>
            <Textarea
              id="dispute-reason"
              rows={4}
              placeholder="Be specific — payment not received, wrong amount, wrong address, etc."
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={dispute.isPending}
              onClick={() => setDisputeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              loading={dispute.isPending}
              disabled={!disputeReason.trim()}
              onClick={handleDispute}
            >
              Raise dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
