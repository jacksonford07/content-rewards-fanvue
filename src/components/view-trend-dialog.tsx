import { useMemo } from "react"
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowSquareOut,
  ChartLineUp,
  Clock,
  Eye,
  Warning,
} from "@phosphor-icons/react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useSubmissionSnapshots } from "@/queries/submissions"
import { formatCompactNumber, platformLabels, timeAgo } from "@/lib/mock-data"
import type { Submission } from "@/lib/types"

export function ViewTrendDialog({
  submission,
  open,
  onOpenChange,
}: {
  submission: Submission
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { data: snapshots, isLoading } = useSubmissionSnapshots(
    submission.id,
    { enabled: open },
  )

  const chartData = useMemo(() => {
    if (!snapshots) return []
    return snapshots
      .filter((s) => s.available)
      .map((s) => ({
        t: new Date(s.capturedAt).getTime(),
        views: s.viewCount,
        label: new Date(s.capturedAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      }))
  }, [snapshots])

  const lockDate = submission.lockDate ? new Date(submission.lockDate) : null
  const daysLeft = lockDate
    ? Math.max(
        0,
        Math.ceil((lockDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      )
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            View trend
            <Badge
              variant="outline"
              className="border-border/70 text-xs text-muted-foreground"
            >
              {platformLabels[submission.platform]}
            </Badge>
          </DialogTitle>
          <DialogDescription className="truncate">
            {submission.campaignTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Metric
            label="Views"
            value={
              submission.lastViewCount != null
                ? formatCompactNumber(submission.lastViewCount)
                : "—"
            }
            icon={<Eye weight="fill" className="size-3.5 shrink-0" />}
            emphasized
          />
          <Metric
            label="Ends in"
            value={
              daysLeft == null
                ? "—"
                : daysLeft === 0
                  ? "Today"
                  : `${daysLeft}d`
            }
            icon={<Clock className="size-3.5 shrink-0" />}
          />
          <Metric
            label="Updated"
            value={
              submission.lastScrapedAt
                ? timeAgo(submission.lastScrapedAt)
                : "—"
            }
            icon={<Clock className="size-3.5 shrink-0" />}
          />
        </div>

        {submission.postDeletedAt && (
          <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
            <Warning className="size-4" weight="fill" />
            <span>
              Post appears deleted — view count frozen at{" "}
              {timeAgo(submission.postDeletedAt)}. Payout at day-30 uses last
              observed value.
            </span>
          </div>
        )}

        <div className="h-64 w-full rounded-md border border-border/60 bg-card/40 p-3">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : chartData.length === 0 ? (
            <EmptyState
              title="Collecting first snapshot"
              subtitle="The initial scrape is in progress. Check back shortly."
            />
          ) : chartData.length === 1 ? (
            <EmptyState
              title={`${formatCompactNumber(chartData[0].views)} views captured`}
              subtitle={`First snapshot · ${chartData[0].label}. The trend line appears after the next scrape (~6 h cadence).`}
              accent
            />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
              >
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => formatCompactNumber(v as number)}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  width={44}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  formatter={(v) => [
                    formatCompactNumber(Number(v)),
                    "views",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <a
          href={submission.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-end text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Open original post
          <ArrowSquareOut className="size-3" />
        </a>
      </DialogContent>
    </Dialog>
  )
}

function EmptyState({
  title,
  subtitle,
  accent,
}: {
  title: string
  subtitle: string
  accent?: boolean
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6 text-center">
      <ChartLineUp
        className={`size-7 ${accent ? "text-primary" : "text-muted-foreground/60"}`}
        weight={accent ? "fill" : "regular"}
      />
      <div
        className={`text-sm font-semibold tabular-nums ${accent ? "text-primary" : "text-foreground"}`}
      >
        {title}
      </div>
      <div className="max-w-xs text-xs leading-relaxed text-muted-foreground">
        {subtitle}
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  icon,
  emphasized,
}: {
  label: string
  value: string
  icon: React.ReactNode
  emphasized?: boolean
}) {
  return (
    <div
      className={
        emphasized
          ? "flex items-center gap-2.5 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5"
          : "flex items-center gap-2.5 rounded-lg border border-border/60 bg-card/60 px-3 py-2.5"
      }
    >
      <div
        className={
          emphasized
            ? "flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary"
            : "flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/60 text-muted-foreground"
        }
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] text-muted-foreground">
          {label}
        </div>
        <div
          className={
            emphasized
              ? "truncate text-sm font-bold tabular-nums text-primary"
              : "truncate text-sm font-semibold tabular-nums"
          }
          title={value}
        >
          {value}
        </div>
      </div>
    </div>
  )
}
