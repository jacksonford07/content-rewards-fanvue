import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowCircleDown,
  ArrowCircleUp,
  Coins,
  Vault,
  Lightning,
  PauseCircle,
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
import { Switch } from "@/components/ui/switch"
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
import {
  myCampaigns,
  campaignTransactions,
  formatCurrency,
} from "@/lib/mock-data"

export function CampaignBudgetPage() {
  const { id } = useParams()
  const campaign = myCampaigns.find((c) => c.id === id)

  const [addFundsOpen, setAddFundsOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [budgetActive, setBudgetActive] = useState(true)

  if (!campaign) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <p className="text-muted-foreground">Campaign not found.</p>
        <Button variant="ghost" asChild className="mt-4">
          <Link to="/creator/campaigns">
            <ArrowLeft className="size-4" /> Back to campaigns
          </Link>
        </Button>
      </div>
    )
  }

  const remaining = campaign.totalBudget - campaign.budgetSpent
  const pct = campaign.totalBudget
    ? Math.round((campaign.budgetSpent / campaign.totalBudget) * 100)
    : 0
  const escrowAvailable = remaining * 0.6
  const escrowLocked = remaining * 0.4

  const transactions = campaignTransactions[campaign.id] ?? []

  const handleAddFunds = () => {
    toast.success("Funds added", {
      description: `${formatCurrency(parseFloat(amount) || 0)} added to ${campaign.title} budget.`,
    })
    setAddFundsOpen(false)
    setAmount("")
  }

  const handleToggleBudget = (checked: boolean) => {
    setBudgetActive(checked)
    toast.success(checked ? "Budget resumed" : "Budget paused", {
      description: checked
        ? "Clippers can earn rewards again."
        : "No new payouts will be released until resumed.",
    })
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

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Budget management
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {campaign.title} — track spend, add funds, and manage escrow.
        </p>
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

      {/* Escrow card + actions */}
      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Vault className="size-4 text-primary" weight="fill" />
              Escrow status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-background/50 p-4">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Available for payouts
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-success">
                  {formatCurrency(escrowAvailable)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Ready to release to clippers
                </p>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/50 p-4">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Locked in escrow
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">
                  {formatCurrency(escrowLocked)}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Pending 30-day view verification
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Button className="w-full" onClick={() => setAddFundsOpen(true)}>
            <Plus className="size-4" weight="bold" />
            Add funds
          </Button>

          <Card className="border-border/60 bg-card/70 p-4 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {budgetActive ? "Budget active" : "Budget paused"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {budgetActive
                    ? "Clippers earn rewards on verified views."
                    : "No new payouts until resumed."}
                </p>
              </div>
              <Switch
                checked={budgetActive}
                onCheckedChange={handleToggleBudget}
              />
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              {budgetActive ? (
                <Badge
                  variant="outline"
                  className="border-success/40 bg-success/10 text-success"
                >
                  <Lightning weight="fill" className="size-3" /> Active
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-warning/40 bg-warning/10 text-warning"
                >
                  <PauseCircle weight="fill" className="size-3" /> Paused
                </Badge>
              )}
            </div>
          </Card>
        </div>
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
                    <p className="text-xs text-muted-foreground">{tx.at}</p>
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
      <Dialog open={addFundsOpen} onOpenChange={setAddFundsOpen}>
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
            <Button variant="ghost" onClick={() => setAddFundsOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!amount || parseFloat(amount) <= 0}
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
