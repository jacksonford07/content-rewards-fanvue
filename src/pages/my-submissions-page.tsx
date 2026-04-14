import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowSquareOut,
  Clock,
  CheckCircle,
  XCircle,
  CurrencyDollar,
  Eye,
  Timer,
} from "@phosphor-icons/react"

import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/page-header"
import { PlatformIcon } from "@/components/platform-icon"
import {
  mySubmissions,
  formatCompactNumber,
  formatCurrency,
  platformLabels,
  timeAgo,
  timeUntil,
} from "@/lib/mock-data"
import type { Submission, SubmissionStatus } from "@/lib/types"

type FilterKey = "all" | "pending" | "approved" | "paid" | "rejected"

const tabs: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
]

export function MySubmissionsPage() {
  const [filter, setFilter] = useState<FilterKey>("all")

  const filtered = useMemo(() => {
    if (filter === "all") return mySubmissions
    return mySubmissions.filter((s) => s.status === filter)
  }, [filter])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="My submissions"
        description="Track the status of every clip you've submitted."
        className="mb-6"
      />

      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as FilterKey)}
        className="mb-6"
      >
        <TabsList>
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={filter} className="mt-6 space-y-3">
          {filtered.length === 0 ? (
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
    </div>
  )
}

function StatusBadge({ status }: { status: SubmissionStatus }) {
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
      label: "Approved · verifying",
      className: "border-success/40 bg-success/10 text-success",
      icon: <CheckCircle className="size-3" weight="fill" />,
    },
    auto_approved: {
      label: "Auto-approved",
      className: "border-success/40 bg-success/10 text-success",
      icon: <CheckCircle className="size-3" weight="fill" />,
    },
    paid: {
      label: "Paid",
      className: "border-primary/40 bg-primary/10 text-primary",
      icon: <CurrencyDollar className="size-3" weight="fill" />,
    },
    rejected: {
      label: "Rejected",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
      icon: <XCircle className="size-3" weight="fill" />,
    },
    flagged: {
      label: "Flagged",
      className: "border-warning/40 bg-warning/10 text-warning",
      icon: <Clock className="size-3" weight="fill" />,
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
              by {submission.campaignCreator} ·{" "}
              {platformLabels[submission.platform]} ·{" "}
              {timeAgo(submission.submittedAt)}
            </p>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={submission.status} />
            {submission.status === "pending" && submission.autoApproveAt && (
              <Badge
                variant="outline"
                className="gap-1.5 border-border/70 text-muted-foreground"
              >
                <Timer className="size-3" />
                Auto-approves in {timeUntil(submission.autoApproveAt)}
              </Badge>
            )}
            {submission.status === "approved" && submission.lockDate && (
              <Badge
                variant="outline"
                className="gap-1.5 border-border/70 text-muted-foreground"
              >
                <Timer className="size-3" />
                View lock in {timeUntil(submission.lockDate)}
              </Badge>
            )}
          </div>

          {submission.status === "rejected" && submission.rejectionReason && (
            <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
              <span className="font-medium">Reason:</span>{" "}
              {submission.rejectionReason}
            </div>
          )}
        </div>

        <Separator orientation="vertical" className="hidden h-16 md:block" />

        {/* Metrics */}
        <div className="flex items-center gap-4 text-sm md:flex-col md:items-end md:gap-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Eye className="size-3.5" />
            <span className="tabular-nums">
              {formatCompactNumber(submission.viewsCurrent)}
            </span>
            <span className="text-[11px]">views</span>
          </div>
          {submission.status === "paid" && submission.payoutAmount && (
            <div className="text-lg font-semibold tabular-nums text-primary">
              +{formatCurrency(submission.payoutAmount)}
            </div>
          )}
        </div>

        {/* Action */}
        <Button variant="outline" size="sm" asChild className="md:ml-2">
          <a
            href={submission.postUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            View post
            <ArrowSquareOut className="size-3.5" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
