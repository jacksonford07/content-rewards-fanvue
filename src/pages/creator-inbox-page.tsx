import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  CheckCircle,
  XCircle,
  Prohibit,
  ArrowSquareOut,
  ChartLineUp,
  CurrencyDollar,
  DotsThreeVertical,
  Eye,
  Clock,
  FastForward,
  Warning,
} from "@phosphor-icons/react"

import { ViewTrendDialog } from "@/components/view-trend-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
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
  useApproveSubmission,
  useBanSubmission,
  useDevFastForward,
  useInboxStats,
  useInboxSubmissions,
  useRejectSubmission,
  useVerifyViews,
  type InboxTab,
} from "@/queries/submissions"
import { PaginationBar } from "@/components/pagination-bar"
import type { Submission } from "@/lib/types"

type TabKey = InboxTab

const tabConfig: { key: TabKey; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "verify", label: "Ready to verify" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
  { key: "banned", label: "Banned" },
]

const validTabs: TabKey[] = [
  "pending",
  "approved",
  "verify",
  "paid",
  "rejected",
  "banned",
]

export function CreatorInboxPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get("tab") as TabKey) || "pending"
  const [tab, setTabState] = useState<TabKey>(
    validTabs.includes(initialTab) ? initialTab : "pending",
  )
  const setTab = (v: TabKey) => {
    setTabState(v)
    const next = new URLSearchParams(searchParams)
    if (v === "pending") next.delete("tab")
    else next.set("tab", v)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    const urlTab = searchParams.get("tab") as TabKey | null
    if (urlTab && validTabs.includes(urlTab) && urlTab !== tab) {
      setTabState(urlTab)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])
  const [autoApprove, setAutoApprove] = useState(false)
  const [rejectOpen, setRejectOpen] = useState<Submission | null>(null)
  const [banOpen, setBanOpen] = useState<Submission | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [banReason, setBanReason] = useState("")

  // Per-tab independent page state
  const [pages, setPages] = useState<Record<TabKey, number>>({
    pending: 1,
    approved: 1,
    verify: 1,
    paid: 1,
    rejected: 1,
    banned: 1,
  })
  const page = pages[tab]
  const setPage = (p: number) => setPages((prev) => ({ ...prev, [tab]: p }))
  const limit = 20

  const { data: stats } = useInboxStats()
  const { data: inboxResp, isLoading: loading } = useInboxSubmissions({
    tab,
    page,
    limit,
  })
  const items: Submission[] = inboxResp?.data ?? []
  const meta = inboxResp?.meta

  const counts = {
    pending: stats?.pending ?? 0,
    approved: stats?.approved ?? 0,
    verify: stats?.verify ?? 0,
    paid: stats?.paid ?? 0,
    rejected: stats?.rejected ?? 0,
    banned: stats?.banned ?? 0,
  }


  const approveMutation = useApproveSubmission()
  const rejectMutation = useRejectSubmission()
  const banMutation = useBanSubmission()
  const fastForwardMutation = useDevFastForward()
  const verifyMutation = useVerifyViews()

  const approve = async (s: Submission) => {
    try {
      await approveMutation.mutateAsync(s.id)
      toast.success("Submission approved", {
        description: `${s.fanName}'s clip entered 30-day view verification.`,
      })
    } catch {
      toast.error("Failed to approve")
    }
  }

  const reject = async () => {
    if (!rejectOpen) return
    try {
      await rejectMutation.mutateAsync({ id: rejectOpen.id, reason: rejectReason })
      toast.success("Submission rejected", {
        description: `${rejectOpen.fanName} will be notified with your reason.`,
      })
    } catch {
      toast.error("Failed to reject")
    }
    setRejectOpen(null)
    setRejectReason("")
  }

  const ban = async () => {
    if (!banOpen) return
    try {
      await banMutation.mutateAsync({ id: banOpen.id, reason: banReason.trim() })
      toast.success("Clipper banned from campaign", {
        description: `${banOpen.fanName} can no longer submit to this campaign.`,
      })
    } catch {
      toast.error("Failed to ban")
    }
    setBanOpen(null)
    setBanReason("")
  }

  const fastForward = async (s: Submission) => {
    try {
      await fastForwardMutation.mutateAsync(s.id)
      toast.success("Lock date moved to now", {
        description: `${s.fanName}'s clip is in Ready to verify.`,
      })
    } catch {
      toast.error("Failed to fast-forward")
    }
  }

  const verifyViews = async (submission: Submission, views: number) => {
    try {
      const res = await verifyMutation.mutateAsync({ id: submission.id, views })
      toast.success(`Payout released: $${res.payoutAmount.toFixed(2)}`, {
        description: `${views.toLocaleString()} views verified for ${submission.fanName}'s clip.`,
      })
    } catch {
      toast.error("Failed to verify views")
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Submission inbox"
        description="Review clips submitted to your campaigns. 48h auto-approve window active."
        actions={
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-2">
            <Switch
              checked={autoApprove}
              onCheckedChange={setAutoApprove}
              id="auto-approve"
            />
            <Label
              htmlFor="auto-approve"
              className="cursor-pointer text-xs text-muted-foreground"
            >
              Auto-approve future clean submissions
            </Label>
          </div>
        }
        className="mb-6"
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabKey)}
        className="mb-6"
      >
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList>
            {tabConfig.map((t) => (
              <TabsTrigger
                key={t.key}
                value={t.key}
                className="gap-1.5"
              >
                {t.label}
                {counts[t.key] > 0 && (
                  <span className="text-[11px] tabular-nums text-muted-foreground">{counts[t.key]}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-lg border border-border/50 bg-background/40 p-4">
              <Skeleton className="size-16 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-2 p-12 text-center">
          <CheckCircle className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nothing to review in this tab.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <InboxRow
              key={s.id}
              submission={s}
              onApprove={() => approve(s)}
              onReject={() => setRejectOpen(s)}
              onBan={() => setBanOpen(s)}
              onVerifyViews={(views) => verifyViews(s, views)}
              onFastForward={() => fastForward(s)}
              showVerify={tab === "verify"}
            />
          ))}
        </div>
      )}

      {meta && (
        <PaginationBar
          page={meta.page}
          limit={meta.limit}
          totalItems={meta.totalItems}
          totalPages={meta.totalPages}
          onPageChange={setPage}
        />
      )}

      {/* Reject Dialog */}
      <Dialog open={!!rejectOpen} onOpenChange={(v) => !v && setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject submission</DialogTitle>
            <DialogDescription>
              The clipper will receive this reason so they can learn for future
              submissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (sent to clipper)</Label>
            <Textarea
              id="reason"
              rows={4}
              placeholder="e.g. Clip exceeds max length. Please re-edit to under 45 seconds."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              onClick={reject}
            >
              Reject submission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban dialog */}
      <Dialog open={!!banOpen} onOpenChange={(v) => { if (!v) { setBanOpen(null); setBanReason("") } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban clipper from campaign?</DialogTitle>
            <DialogDescription>
              {banOpen?.fanName} will no longer be able to submit to this
              campaign. Existing approved submissions stay.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ban-reason">Reason (sent to clipper)</Label>
            <Textarea
              id="ban-reason"
              rows={4}
              placeholder="e.g. Suspected view botting or recycled content."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setBanOpen(null); setBanReason("") }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!banReason.trim()}
              onClick={ban}
            >
              Ban clipper
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function calculatePayout(views: number, submission: Submission) {
  if (views < submission.minPayoutThreshold) return 0
  let payout = (views / 1000) * submission.rewardRatePer1k
  if (submission.maxPayoutPerClip && payout > submission.maxPayoutPerClip)
    payout = submission.maxPayoutPerClip
  return Math.round(payout * 100) / 100
}

function InboxRow({
  submission,
  onApprove,
  onReject,
  onBan,
  onVerifyViews,
  onFastForward,
  showVerify,
}: {
  submission: Submission
  onApprove: () => void
  onReject: () => void
  onBan: () => void
  onVerifyViews: (views: number) => Promise<void>
  onFastForward: () => void
  showVerify: boolean
}) {
  const [viewsInput, setViewsInput] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [capModalOpen, setCapModalOpen] = useState(false)
  const [isReleasing, setIsReleasing] = useState(false)
  const [trendOpen, setTrendOpen] = useState(false)

  const readOnly =
    submission.status === "approved" ||
    submission.status === "rejected" ||
    submission.status === "auto_approved"

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

  const canFastForward =
    import.meta.env.DEV &&
    !showVerify &&
    (submission.status === "approved" || submission.status === "auto_approved") &&
    !!submission.lockDate &&
    new Date(submission.lockDate) > new Date()

  const parsedViews = parseInt(viewsInput, 10)
  const validViews = !isNaN(parsedViews) && parsedViews >= 0
  const previewPayout = validViews ? calculatePayout(parsedViews, submission) : null

  const budgetRemaining = submission.campaignBudgetRemaining ?? Infinity
  const payoutExceedsBudget =
    previewPayout !== null && previewPayout > budgetRemaining
  const cappedPayout =
    previewPayout !== null ? Math.min(previewPayout, budgetRemaining) : 0

  const handleSubmitViews = () => {
    if (!validViews) return
    if (payoutExceedsBudget) {
      setCapModalOpen(true)
      return
    }
    setConfirming(true)
  }

  const handleConfirm = async () => {
    if (!validViews) return
    setIsReleasing(true)
    await onVerifyViews(parsedViews)
    setIsReleasing(false)
    setConfirming(false)
    setViewsInput("")
  }

  const handleCapConfirm = async () => {
    if (!validViews) return
    setIsReleasing(true)
    await onVerifyViews(parsedViews)
    setIsReleasing(false)
    setCapModalOpen(false)
    setViewsInput("")
  }

  return (
    <Card className="overflow-hidden border-border/60 bg-card/70 backdrop-blur">
      <CardContent className="flex flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          {/* Thumbnail + platform */}
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

          {/* Clipper info */}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-9 shrink-0 ring-1 ring-border">
                <AvatarImage src={submission.fanAvatarUrl} />
                <AvatarFallback>{submission.fanName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{submission.fanName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  @{submission.fanHandle} · {platformLabels[submission.platform]}
                  {submission.platformUsername
                    ? ` · @${submission.platformUsername}`
                    : ""}{" "}
                  · {timeAgo(submission.submittedAt)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {submission.viewsAtDay30 != null ? (
                <span className="flex items-center gap-1">
                  <Eye className="size-3" />
                  {formatCompactNumber(submission.viewsAtDay30)} final views
                </span>
              ) : showLiveViews ? (
                <span className="flex items-center gap-1">
                  <Eye className="size-3" />
                  {formatCompactNumber(submission.lastViewCount!)} live views
                </span>
              ) : null}
              {isTracking && submission.pendingEarnings ? (
                <span className="flex items-center gap-1 font-semibold text-primary">
                  <CurrencyDollar weight="bold" className="size-3" />
                  {formatCurrency(submission.pendingEarnings)} reserved
                </span>
              ) : null}
              {submission.status === "paid" &&
              submission.payoutAmount != null ? (
                <span className="flex items-center gap-1 font-semibold text-success">
                  <CurrencyDollar weight="bold" className="size-3" />
                  {formatCurrency(submission.payoutAmount)} paid
                </span>
              ) : null}
              {showVerify && (
                <span className="flex items-center gap-1 text-primary font-medium">
                  <CheckCircle className="size-3" />
                  Ready to verify
                </span>
              )}
              {submission.postDeletedAt && (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-warning/40 bg-warning/10 text-warning"
                >
                  <Warning weight="fill" className="size-3" />
                  Post deleted · count frozen
                </Badge>
              )}
              {submission.status === "pending" && submission.autoApproveAt && (
                <Badge variant="outline" className="gap-1.5 border-border/70 text-muted-foreground">
                  <Clock className="size-3" />
                  Auto-approves in {timeUntil(submission.autoApproveAt)}
                </Badge>
              )}
              {!showVerify &&
                (submission.status === "approved" || submission.status === "auto_approved") &&
                submission.lockDate && (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    Day 30 in {timeUntil(submission.lockDate, true)}
                  </span>
                )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!readOnly && !showVerify && (
              <>
                <Button size="sm" onClick={onApprove}>
                  <CheckCircle weight="fill" className="size-4" />
                  Approve
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="destructive" onClick={onReject}>
                        <XCircle weight="fill" className="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reject submission</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}

            {canFastForward && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onFastForward}
                      className="border border-dashed border-warning/40 text-warning hover:bg-warning/10 hover:text-warning"
                    >
                      <FastForward weight="fill" className="size-4" />
                      Skip to verify
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Dev only — moves lockDate to now so this clip enters Ready to verify.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="More actions"
                >
                  <DotsThreeVertical weight="bold" className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canShowTrend && (
                  <DropdownMenuItem onSelect={() => setTrendOpen(true)}>
                    <ChartLineUp className="size-4" />
                    View trend
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <a
                    href={submission.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ArrowSquareOut className="size-4" />
                    Open original post
                  </a>
                </DropdownMenuItem>
                {!readOnly && !showVerify && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={onBan}>
                      <Prohibit weight="bold" className="size-4" />
                      Ban clipper from campaign
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Rejection / ban reason — visible to creator */}
        {submission.status === "rejected" && submission.rejectionReason && (
          <>
            <Separator />
            <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              {submission.isBanned ? (
                <Prohibit weight="bold" className="mt-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <XCircle weight="fill" className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-destructive">
                  {submission.isBanned
                    ? `Banned ${submission.fanName} from this campaign`
                    : "Rejection reason"}
                </p>
                <p className="mt-0.5 text-sm text-foreground/90">
                  {submission.rejectionReason}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Verify views section */}
        {showVerify && !confirming && (
          <>
            <Separator />
            <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`views-${submission.id}`} className="text-sm font-medium">
                  Enter view count from {platformLabels[submission.platform]}
                </Label>
                <Input
                  id={`views-${submission.id}`}
                  type="number"
                  min={0}
                  placeholder="e.g. 45000"
                  value={viewsInput}
                  onChange={(e) => setViewsInput(e.target.value)}
                  className="max-w-48"
                />
              </div>
              {previewPayout !== null && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Estimated payout: </span>
                  <span className="font-semibold text-primary">${previewPayout.toFixed(2)}</span>
                  {parsedViews < submission.minPayoutThreshold && (
                    <p className="text-xs text-muted-foreground">
                      Below minimum threshold ({submission.minPayoutThreshold.toLocaleString()} views)
                    </p>
                  )}
                </div>
              )}
              <Button
                size="sm"
                disabled={!validViews}
                onClick={handleSubmitViews}
              >
                <Eye className="size-4" />
                Submit views
              </Button>
            </div>
          </>
        )}

        {/* Confirm payout */}
        {showVerify && confirming && (
          <>
            <Separator />
            <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Confirm payout</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span>
                  <span className="text-muted-foreground">Views: </span>
                  <span className="font-medium">{parsedViews.toLocaleString()}</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Rate: </span>
                  <span className="font-medium">${submission.rewardRatePer1k}/1K views</span>
                </span>
                <span>
                  <span className="text-muted-foreground">Payout: </span>
                  <span className="font-semibold text-primary">${previewPayout?.toFixed(2)}</span>
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isReleasing}
                  onClick={() => setConfirming(false)}
                >
                  Back
                </Button>
                <Button size="sm" loading={isReleasing} onClick={handleConfirm}>
                  <CheckCircle weight="fill" className="size-4" />
                  Confirm &amp; release payout
                </Button>
              </div>
            </div>
          </>
        )}

        <AlertDialog
          open={capModalOpen}
          onOpenChange={(open) => {
            if (!isReleasing) setCapModalOpen(open)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Payout will be capped</AlertDialogTitle>
              <AlertDialogDescription>
                This clip earned{" "}
                <strong className="text-foreground">
                  {previewPayout !== null ? formatCurrency(previewPayout) : ""}
                </strong>{" "}
                at {parsedViews.toLocaleString()} views, but this campaign has only{" "}
                <strong className="text-foreground">
                  {formatCurrency(budgetRemaining)}
                </strong>{" "}
                left in budget. Only{" "}
                <strong className="text-foreground">
                  {formatCurrency(cappedPayout)}
                </strong>{" "}
                will be paid out to {submission.fanName}, and the campaign will be
                marked completed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isReleasing}>
                Cancel
              </AlertDialogCancel>
              <Button loading={isReleasing} onClick={handleCapConfirm}>
                Release {formatCurrency(cappedPayout)}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {canShowTrend && (
          <ViewTrendDialog
            submission={submission}
            open={trendOpen}
            onOpenChange={setTrendOpen}
          />
        )}
      </CardContent>
    </Card>
  )
}
