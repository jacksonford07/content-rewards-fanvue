import { Link, useParams, useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  CurrencyDollar,
  Info,
  Lightning,
  Lock,
} from "@phosphor-icons/react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency } from "@/lib/mock-data"
import { useCampaign } from "@/queries/campaigns"
import { NotFoundCard } from "@/components/not-found-card"

// v1.1: payouts moved off-platform. This page is intentionally minimal —
// it shows the declared budget and a placeholder for off-platform payout
// history. M2 will populate it from the `payout_events` ledger; M3 will
// add the dispute admin queue link for creators reviewing flagged payouts.

export function CampaignBudgetPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    data: campaign,
    isLoading: loading,
    isError: campaignError,
  } = useCampaign(id)

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

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Budget
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {campaign.title} — declared budget and payout history.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" weight="fill" />
        <p>
          Payouts happen off-platform — you mark each clipper paid here once
          you've sent them money via PayPal, crypto, bank transfer, or
          whichever method you've agreed on. Detailed payout tracking arrives
          when M2 ships.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            What you've committed to spend across this campaign
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
      </div>

      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Off-platform payout history will appear here in v1.1 (M2).
        </CardContent>
      </Card>
    </div>
  )
}
