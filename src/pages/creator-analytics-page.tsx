import { useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  Eye,
  Users,
  CurrencyDollar,
  ChartLine,
  Fire,
} from "@phosphor-icons/react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { PageHeader } from "@/components/page-header"
import { PaginationBar } from "@/components/pagination-bar"
import { NotFoundCard } from "@/components/not-found-card"
import {
  formatCompactNumber,
  formatCurrency,
} from "@/lib/mock-data"
import { useCampaignBreakdown, useDashboard } from "@/queries/analytics"

export function CreatorAnalyticsPage() {
  const [searchParams] = useSearchParams()
  const campaignId = searchParams.get("campaign") ?? undefined

  const [page, setPage] = useState(1)
  const limit = 20

  const {
    data: dashboard,
    isLoading: dashboardLoading,
    isError: dashboardError,
  } = useDashboard(campaignId)
  const { data: breakdownResp, isLoading: breakdownLoading } =
    useCampaignBreakdown({ page, limit, enabled: !campaignId })
  const campaignBreakdown = breakdownResp?.data ?? []
  const meta = breakdownResp?.meta
  const loading = dashboardLoading || (!campaignId && breakdownLoading)

  // When a specific campaign id is requested and the dashboard call fails, or
  // returns a dashboard with no campaignTitle (server couldn't match it to a
  // campaign the current creator owns), show a not-found page.
  if (campaignId && !dashboardLoading) {
    const invalid = dashboardError || (dashboard && dashboard.campaignTitle === null)
    if (invalid) {
      return (
        <NotFoundCard
          title="Campaign not found"
          description="This campaign may have been deleted, or you don't have access to it."
          backTo="/creator/analytics"
          backLabel="Back to analytics"
        />
      )
    }
  }

  const totalViews = dashboard?.totalViews ?? 0
  const totalSpend = dashboard?.totalSpend ?? 0
  const totalClippers = dashboard?.totalClippers ?? 0
  const cpm = dashboard?.averageCpm ?? 0
  const campaignTitle = dashboard?.campaignTitle ?? null

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      {loading && campaignId ? (
        <div className="mb-6 space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-64" />
        </div>
      ) : (
        <PageHeader
          title={campaignTitle ? `Analytics — ${campaignTitle}` : "Analytics"}
          description={
            campaignId
              ? "Performance metrics for this campaign."
              : "Monitor performance across all your campaigns."
          }
          className="mb-6"
        />
      )}

      {/* KPI cards */}
      {loading ? (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/60 bg-card/70 p-4">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="mt-3 h-3 w-20" />
              <Skeleton className="mt-2 h-7 w-16" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            icon={<Eye className="size-4" weight="fill" />}
            label="Total views"
            value={formatCompactNumber(totalViews)}
          />
          <KpiCard
            icon={<CurrencyDollar className="size-4" weight="fill" />}
            label="Total spend"
            value={formatCurrency(totalSpend)}
          />
          <KpiCard
            icon={<Users className="size-4" weight="fill" />}
            label="Active clippers"
            value={totalClippers.toString()}
          />
          <KpiCard
            icon={<ChartLine className="size-4" weight="fill" />}
            label="Effective CPM"
            value={formatCurrency(cpm)}
          />
        </div>
      )}

      {/* Campaign breakdown — only shown on overview (no campaign filter) */}
      {!campaignId && (
        loading ? (
          <Card className="border-border/60 bg-card/70">
            <CardHeader>
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-3">
                  <Skeleton className="size-12 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-1 w-full" />
                  </div>
                  <Skeleton className="h-5 w-14" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : campaignBreakdown.length === 0 ? (
          <Card className="flex flex-col items-center justify-center gap-2 border-border/60 bg-card/70 p-12 text-center">
            <Fire className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No campaigns yet. Create your first campaign to see analytics.
            </p>
          </Card>
        ) : (
          <>
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Fire className="size-4 text-primary" weight="fill" />
                Campaign breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaignBreakdown.map((c) => {
                const pct = c.totalBudget
                  ? Math.round((c.budgetSpent / c.totalBudget) * 100)
                  : 0
                return (
                  <Link
                    key={c.id}
                    to={`/creator/analytics?campaign=${c.id}`}
                    className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-3 transition-colors hover:border-border hover:bg-background/70"
                  >
                    <img
                      src={c.sourceThumbnailUrl}
                      alt=""
                      className="size-12 shrink-0 rounded-md object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium">
                        {c.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{formatCompactNumber(c.totalViews)} views</span>
                        <span>·</span>
                        <span>{c.activeClippers} clippers</span>
                      </div>
                      <Progress value={pct} className="mt-1.5 h-1" />
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">
                        {formatCurrency(c.budgetSpent)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        of {formatCurrency(c.totalBudget)}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </CardContent>
          </Card>
          {meta && (
            <PaginationBar
              page={meta.page}
              limit={meta.limit}
              totalItems={meta.totalItems}
              totalPages={meta.totalPages}
              onPageChange={setPage}
            />
          )}
          </>
        )
      )}
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <Card className="border-border/60 bg-card/70 p-4 backdrop-blur">
      <div className="inline-flex size-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  )
}
