import {
  Eye,
  Users,
  CurrencyDollar,
  TrendUp,
  TrendDown,
  ChartLine,
  Fire,
} from "@phosphor-icons/react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/page-header"
import {
  myCampaigns,
  formatCompactNumber,
  formatCurrency,
} from "@/lib/mock-data"

// Fake daily series
const viewsSeries = [
  12, 18, 25, 22, 32, 45, 58, 52, 68, 72, 85, 92, 88, 104, 125, 134, 146, 158,
  172, 168, 189, 204, 215, 228, 246, 258, 272, 285, 298, 312,
]
const spendSeries = [
  2, 3, 5, 4, 7, 9, 11, 10, 13, 15, 18, 19, 18, 22, 26, 28, 31, 33, 36, 35, 39,
  42, 45, 48, 51, 54, 57, 60, 63, 66,
]

function buildPath(values: number[]): string {
  if (!values.length) return ""
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const stepX = 100 / (values.length - 1)
  const points = values.map((v, i) => {
    const x = i * stepX
    const y = 100 - ((v - min) / range) * 90 - 5
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  return `M ${points.join(" L ")}`
}

function buildAreaPath(values: number[]): string {
  const line = buildPath(values)
  if (!line) return ""
  return `${line} L 100,100 L 0,100 Z`
}

export function CreatorAnalyticsPage() {
  const totalViews = myCampaigns.reduce((s, c) => s + c.totalViews, 0)
  const totalSpend = myCampaigns.reduce((s, c) => s + c.budgetSpent, 0)
  const totalClippers = myCampaigns.reduce((s, c) => s + c.activeClippers, 0)
  const cpm = totalViews ? (totalSpend / totalViews) * 1000 : 0

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Analytics"
        description="Monitor performance across all your campaigns."
        actions={
          <Select defaultValue="30d">
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        }
        className="mb-6"
      />

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          icon={<Eye className="size-4" weight="fill" />}
          label="Total views"
          value={formatCompactNumber(totalViews)}
          change="+24.8%"
          up
        />
        <KpiCard
          icon={<CurrencyDollar className="size-4" weight="fill" />}
          label="Total spend"
          value={formatCurrency(totalSpend)}
          change="+12.3%"
          up
        />
        <KpiCard
          icon={<Users className="size-4" weight="fill" />}
          label="Active clippers"
          value={totalClippers.toString()}
          change="+8.1%"
          up
        />
        <KpiCard
          icon={<ChartLine className="size-4" weight="fill" />}
          label="Effective CPM"
          value={formatCurrency(cpm)}
          change="-3.2%"
          up={false}
        />
      </div>

      {/* Charts */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">Views over time</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Daily verified views across all campaigns
              </p>
            </div>
            <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
              <TrendUp weight="bold" className="size-3" />
              +24.8%
            </Badge>
          </CardHeader>
          <CardContent>
            <ChartSvg values={viewsSeries} color="oklch(0.72 0.20 293)" />
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm">Spend over time</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Daily payout released from escrow
              </p>
            </div>
            <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
              <TrendUp weight="bold" className="size-3" />
              +12.3%
            </Badge>
          </CardHeader>
          <CardContent>
            <ChartSvg values={spendSeries} color="oklch(0.72 0.15 200)" />
          </CardContent>
        </Card>
      </div>

      {/* Top campaigns */}
      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Fire className="size-4 text-primary" weight="fill" />
            Campaign breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {myCampaigns.map((c) => {
            const pct = c.totalBudget
              ? Math.round((c.budgetSpent / c.totalBudget) * 100)
              : 0
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-background/40 p-3"
              >
                <img
                  src={c.sourceThumbnailUrl}
                  alt=""
                  className="size-12 shrink-0 rounded-md object-cover"
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
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCard({
  icon,
  label,
  value,
  change,
  up,
}: {
  icon: React.ReactNode
  label: string
  value: string
  change: string
  up: boolean
}) {
  return (
    <Card className="border-border/60 bg-card/70 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="inline-flex size-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
          {icon}
        </div>
        <span
          className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${
            up ? "text-success" : "text-destructive"
          }`}
        >
          {up ? (
            <TrendUp weight="bold" className="size-3" />
          ) : (
            <TrendDown weight="bold" className="size-3" />
          )}
          {change}
        </span>
      </div>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  )
}

function ChartSvg({ values, color }: { values: number[]; color: string }) {
  const line = buildPath(values)
  const area = buildAreaPath(values)
  const uid = color.replace(/\W/g, "")
  return (
    <div className="aspect-[2/1] w-full">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id={`grad-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* grid */}
        {[20, 40, 60, 80].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="0.3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={area} fill={`url(#grad-${uid})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="1.2"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}
