import { useState } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  ArrowCircleDown,
  ArrowCircleUp,
  Coins,
  Lightning,
  CheckCircle,
  Clock,
  CurrencyDollar,
  Plus,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Skeleton } from "@/components/ui/skeleton"
import {
  formatCurrency,
} from "@/lib/mock-data"
import { useAuth } from "@/hooks/use-auth"
import {
  useCampaign,
  useCampaignTransactions,
  useFundCampaign,
} from "@/queries/campaigns"
import { NotFoundCard } from "@/components/not-found-card"
import type { BudgetTransaction } from "@/lib/types"

export function CampaignBudgetPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const {
    data: campaign,
    isLoading: campaignLoading,
    isError: campaignError,
  } = useCampaign(id)
  const { data: transactionsData = [], isLoading: txLoading } =
    useCampaignTransactions(id)
  const transactions = transactionsData as unknown as BudgetTransaction[]
  const loading = campaignLoading || txLoading
  const fundMutation = useFundCampaign()

  const [addFundsOpen, setAddFundsOpen] = useState(false)
  const [amount, setAmount] = useState("")

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <Skeleton className="h-4 w-56 mb-6" />
        <div className="mb-6 space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/60 bg-card/70 p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-3 h-7 w-24" />
              {i === 2 && <Skeleton className="mt-2 h-1.5 w-full" />}
            </Card>
          ))}
        </div>
        <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card className="border-border/60 bg-card/70 p-6">
            <Skeleton className="h-5 w-28 mb-4" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border/60 p-4 space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-3 w-36" />
                </div>
              ))}
            </div>
          </Card>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Card className="border-border/60 bg-card/70 p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-1 h-3 w-40" />
              <Skeleton className="mt-3 h-5 w-16" />
            </Card>
          </div>
        </div>
        <Card className="border-border/60 bg-card/70 p-6">
          <Skeleton className="h-5 w-44 mb-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </Card>
      </div>
    )
  }

  if (campaignError || (!loading && !campaign)) {
    return (
      <NotFoundCard
        title="Campaign not found"
        description="This campaign may have been deleted, or the link is outdated."
        backTo="/creator/campaigns"
        backLabel="Back to campaigns"
      />
    )
  }

  if (campaign && (campaign.status === "draft" || campaign.status === "pending_budget")) {
    navigate(`/creator/campaigns/${campaign.id}/edit`, { replace: true })
    return null
  }

  if (!campaign) return null

  const remaining = campaign.totalBudget - campaign.budgetSpent
  const pct = campaign.totalBudget
    ? Math.round((campaign.budgetSpent / campaign.totalBudget) * 100)
    : 0

  const handleAddFunds = async () => {
    if (!id) return
    try {
      await fundMutation.mutateAsync({ id, amount: parseFloat(amount) || 0 })
      toast.success("Funds added", {
        description: `${formatCurrency(parseFloat(amount) || 0)} added to ${campaign?.title ?? ""} budget.`,
      })
      await refresh()
      setAddFundsOpen(false)
      setAmount("")
    } catch {
      toast.error("Failed to add funds")
    }
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
                  to={`/creator/campaigns/${campaign.id}/edit`}
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
            Budget management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {campaign.title} — track spend and manage escrow.
          </p>
        </div>
        <Button onClick={() => setAddFundsOpen(true)}>
          <Plus className="size-4" weight="bold" />
          Add funds
        </Button>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="border-border/60 bg-card/70 p-4 backdrop-blur">
          <div className="flex items-center gap-2 text-primary">
            <CurrencyDollar className="size-4" weight="fill" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Total budget
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {formatCurrency(campaign.totalBudget)}
          </p>
        </Card>
        <Card className="border-border/60 bg-card/70 p-4 backdrop-blur">
          <div className="flex items-center gap-2 text-warning">
            <Coins className="size-4" weight="fill" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Spent
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {formatCurrency(campaign.budgetSpent)}
          </p>
        </Card>
        <Card className="border-border/60 bg-card/70 p-4 backdrop-blur">
          <div className="flex items-center gap-2 text-success">
            <Lightning className="size-4" weight="fill" />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Remaining
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {formatCurrency(remaining)}
          </p>
          <Progress value={pct} className="mt-2 h-1.5" />
          <p className="mt-1 text-[10px] text-muted-foreground">
            {pct}% of budget used
          </p>
        </Card>
      </div>

      {/* Transaction history */}
      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="size-4 text-primary" weight="fill" />
            Budget transaction history
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 md:px-4 md:pb-4">
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center gap-3 py-3 md:gap-4"
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full border ${
                      tx.amount >= 0
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {tx.amount >= 0 ? (
                      <ArrowCircleDown className="size-4" weight="fill" />
                    ) : (
                      <ArrowCircleUp className="size-4" weight="fill" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {tx.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        tx.amount >= 0 ? "text-success" : "text-foreground"
                      }`}
                    >
                      {tx.amount >= 0 ? "+" : ""}
                      {formatCurrency(tx.amount)}
                    </span>
                    {tx.status === "pending" ? (
                      <Badge
                        variant="outline"
                        className="h-5 border-warning/40 bg-warning/10 px-1.5 text-[10px] text-warning"
                      >
                        <Clock className="size-2.5" /> Pending
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="h-5 border-border/70 px-1.5 text-[10px] text-muted-foreground"
                      >
                        <CheckCircle className="size-2.5" /> Completed
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add funds dialog */}
      <Dialog
        open={addFundsOpen}
        onOpenChange={(open) => {
          if (!fundMutation.isPending) setAddFundsOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add funds to campaign</DialogTitle>
            <DialogDescription>
              Top up the budget for {campaign.title}. Funds are immediately
              escrowed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[100, 500, 1000].map((n) => (
                <Button
                  key={n}
                  variant="outline"
                  onClick={() => setAmount(n.toString())}
                >
                  ${n}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="topup-amount">Custom amount</Label>
              <Input
                id="topup-amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={fundMutation.isPending}
              onClick={() => setAddFundsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!amount || parseFloat(amount) <= 0}
              loading={fundMutation.isPending}
              onClick={handleAddFunds}
            >
              Add {amount ? formatCurrency(parseFloat(amount)) : "funds"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
