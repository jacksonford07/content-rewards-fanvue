import { useMemo, useState } from "react"
import {
  CheckCircle,
  XCircle,
  Prohibit,
  ArrowSquareOut,
  Eye,
  Clock,
  WarningCircle,
  Sparkle,
  ChatCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/page-header"
import { PlatformIcon } from "@/components/platform-icon"
import {
  inboxSubmissions,
  formatCompactNumber,
  platformLabels,
  timeAgo,
  timeUntil,
} from "@/lib/mock-data"
import type { Submission } from "@/lib/types"

type TabKey = "pending" | "approved" | "flagged" | "rejected"

const tabConfig: {
  key: TabKey
  label: string
  match: (s: Submission) => boolean
}[] = [
  {
    key: "pending",
    label: "Pending",
    match: (s) => s.status === "pending",
  },
  {
    key: "approved",
    label: "Approved",
    match: (s) => s.status === "approved" || s.status === "auto_approved",
  },
  {
    key: "flagged",
    label: "Flagged",
    match: (s) => s.status === "flagged" || s.aiReviewResult === "flagged",
  },
  {
    key: "rejected",
    label: "Rejected",
    match: (s) => s.status === "rejected",
  },
]

export function CreatorInboxPage() {
  const [tab, setTab] = useState<TabKey>("pending")
  const [autoApprove, setAutoApprove] = useState(false)
  const [rejectOpen, setRejectOpen] = useState<Submission | null>(null)
  const [banOpen, setBanOpen] = useState<Submission | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = {
      pending: 0,
      approved: 0,
      flagged: 0,
      rejected: 0,
    }
    tabConfig.forEach((t) => {
      c[t.key] = inboxSubmissions.filter(t.match).length
    })
    return c
  }, [])

  const items = useMemo(() => {
    const config = tabConfig.find((t) => t.key === tab)!
    return inboxSubmissions.filter(config.match)
  }, [tab])

  const approve = (s: Submission) => {
    toast.success("Submission approved", {
      description: `${s.fanName}'s clip entered 30-day view verification.`,
    })
  }

  const reject = () => {
    toast.success("Submission rejected", {
      description: `${rejectOpen?.fanName} will be notified with your reason.`,
    })
    setRejectOpen(null)
    setRejectReason("")
  }

  const ban = () => {
    toast.success("Clipper banned from campaign", {
      description: `${banOpen?.fanName} can no longer submit to this campaign.`,
    })
    setBanOpen(null)
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
        <TabsList>
          {tabConfig.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className="gap-1.5"
            >
              {t.label}
              <Badge
                variant="outline"
                className="h-4 min-w-4 rounded-full px-1 text-[10px]"
              >
                {counts[t.key]}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {items.length === 0 ? (
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
            />
          ))}
        </div>
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

      {/* Ban alert */}
      <AlertDialog open={!!banOpen} onOpenChange={(v) => !v && setBanOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban clipper from campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              {banOpen?.fanName} will no longer be able to submit to this
              campaign. Existing approved submissions stay. This action can be
              reversed from the clipper profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={ban}>Ban clipper</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function InboxRow({
  submission,
  onApprove,
  onReject,
  onBan,
}: {
  submission: Submission
  onApprove: () => void
  onReject: () => void
  onBan: () => void
}) {
  const isFlagged = submission.aiReviewResult === "flagged"
  const readOnly =
    submission.status === "approved" ||
    submission.status === "rejected" ||
    submission.status === "auto_approved"

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
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Avatar className="size-10 shrink-0 ring-1 ring-border">
              <AvatarImage src={submission.fanAvatarUrl} />
              <AvatarFallback>{submission.fanName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold">{submission.fanName}</p>
                <Badge variant="outline" className="border-border/70 text-xs">
                  {formatCompactNumber(submission.fanFollowers)} followers
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                @{submission.fanHandle} · {platformLabels[submission.platform]}{" "}
                · {timeAgo(submission.submittedAt)}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {isFlagged ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-warning/40 bg-warning/10 text-warning"
                  >
                    <WarningCircle weight="fill" className="size-3" />
                    AI flagged
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1 border-success/40 bg-success/10 text-success"
                  >
                    <Sparkle weight="fill" className="size-3" />
                    AI clean
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="gap-1 border-border/70 text-muted-foreground"
                >
                  <Eye className="size-3" />
                  {formatCompactNumber(submission.viewsCurrent)} views
                </Badge>
                {submission.status === "pending" && submission.autoApproveAt && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-border/70 text-muted-foreground"
                  >
                    <Clock className="size-3" />
                    Auto-approves in {timeUntil(submission.autoApproveAt)}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 md:flex-col md:items-stretch lg:flex-row">
            <Button variant="outline" size="sm" asChild className="flex-1">
              <a
                href={submission.postUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                View post
                <ArrowSquareOut className="size-3.5" />
              </a>
            </Button>

            {!readOnly && (
              <div className="flex gap-2">
                <Button size="sm" onClick={onApprove}>
                  <CheckCircle weight="fill" className="size-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onReject}
                  aria-label="Reject"
                >
                  <XCircle weight="fill" className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onBan}
                  aria-label="Ban fan"
                >
                  <Prohibit weight="bold" className="size-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {isFlagged && submission.aiNotes && (
          <>
            <Separator />
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <ChatCircle
                weight="fill"
                className="mt-0.5 size-4 shrink-0 text-warning"
              />
              <div>
                <p className="text-xs font-medium text-warning">AI review note</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {submission.aiNotes}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
