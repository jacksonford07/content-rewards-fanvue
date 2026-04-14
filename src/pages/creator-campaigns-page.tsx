import { Link } from "react-router-dom"
import {
  Plus,
  Eye,
  Users,
  CurrencyDollar,
  DotsThreeVertical,
  TrendUp,
  Lightning,
  PencilSimple,
  PauseCircle,
  ChartLine,
  Tray,
  Wallet,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageHeader } from "@/components/page-header"
import { PlatformIcon } from "@/components/platform-icon"
import {
  myCampaigns,
  formatCompactNumber,
  formatCurrency,
} from "@/lib/mock-data"

export function CreatorCampaignsPage() {
  const activeCampaigns = myCampaigns.filter((c) => c.status === "active")
  const totalSpend = myCampaigns.reduce((s, c) => s + c.budgetSpent, 0)
  const totalViews = myCampaigns.reduce((s, c) => s + c.totalViews, 0)
  const totalClippers = myCampaigns.reduce((s, c) => s + c.activeClippers, 0)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="My campaigns"
        description="Manage your clipping campaigns, track performance, and fund budgets."
        actions={
          <Button asChild>
            <Link to="/creator/campaigns/new">
              <Plus className="size-4" weight="bold" />
              New campaign
            </Link>
          </Button>
        }
        className="mb-6"
      />

      {/* Quick stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <DashStat
          icon={<Lightning className="size-4" weight="fill" />}
          label="Active campaigns"
          value={activeCampaigns.length.toString()}
          accent="success"
        />
        <DashStat
          icon={<Users className="size-4" weight="fill" />}
          label="Total clippers"
          value={totalClippers.toString()}
          accent="primary"
        />
        <DashStat
          icon={<Eye className="size-4" weight="fill" />}
          label="Total views"
          value={formatCompactNumber(totalViews)}
          accent="primary"
        />
        <DashStat
          icon={<CurrencyDollar className="size-4" weight="fill" />}
          label="Total spend"
          value={formatCurrency(totalSpend)}
          accent="warning"
        />
      </div>

      {/* Campaign cards */}
      <div className="space-y-4">
        {myCampaigns.map((c) => {
          const pct = c.totalBudget
            ? Math.round((c.budgetSpent / c.totalBudget) * 100)
            : 0
          return (
            <Card
              key={c.id}
              className="overflow-hidden border-border/60 bg-card/70 backdrop-blur"
            >
              <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:p-5">
                <img
                  src={c.sourceThumbnailUrl}
                  alt={c.title}
                  className="aspect-video w-full shrink-0 rounded-lg object-cover md:h-24 md:w-40"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            c.status === "active"
                              ? "border-success/40 bg-success/10 text-success"
                              : c.status === "draft"
                              ? "border-border bg-muted text-muted-foreground"
                              : "border-warning/40 bg-warning/10 text-warning"
                          }
                        >
                          {c.status === "active" && (
                            <Lightning weight="fill" className="size-3" />
                          )}
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </Badge>
                      </div>
                      <h3 className="truncate text-base font-semibold">
                        {c.title}
                      </h3>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                        {c.description}
                      </p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <DotsThreeVertical className="size-4" weight="bold" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/creator/inbox?campaign=${c.id}`}>
                            <Tray className="size-4" />
                            View submissions
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/creator/campaigns/${c.id}/edit`}>
                            <PencilSimple className="size-4" />
                            Edit campaign
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to={`/creator/campaigns/${c.id}/budget`}>
                            <Wallet className="size-4" />
                            Manage budget
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <ChartLine className="size-4" />
                          View analytics
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <PauseCircle className="size-4" />
                          Pause campaign
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                    <MiniStat
                      label="Rate"
                      value={`${formatCurrency(c.rewardRatePer1k)}/1K`}
                    />
                    <MiniStat
                      label="Views"
                      value={formatCompactNumber(c.totalViews)}
                    />
                    <MiniStat
                      label="Clippers"
                      value={c.activeClippers.toString()}
                    />
                    <MiniStat
                      label="Submissions"
                      value={c.totalSubmissions.toString()}
                    />
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {formatCurrency(c.budgetSpent)} /{" "}
                        {formatCurrency(c.totalBudget)} spent
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        {c.allowedPlatforms.map((p) => (
                          <PlatformIcon key={p} platform={p} className="size-3" />
                        ))}
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function DashStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: "success" | "warning" | "primary"
}) {
  const accentClasses: Record<string, string> = {
    success: "border-success/30 bg-success/5 text-success",
    warning: "border-warning/30 bg-warning/5 text-warning",
    primary: "border-primary/30 bg-primary/5 text-primary",
  }
  return (
    <Card className="border-border/60 bg-card/70 p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <div
          className={`inline-flex size-8 items-center justify-center rounded-lg border ${
            accent ? accentClasses[accent] : "border-border bg-muted"
          }`}
        >
          {icon}
        </div>
        <TrendUp
          weight="bold"
          className="size-4 text-success opacity-80"
        />
      </div>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}
