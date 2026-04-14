import { useState } from "react"
import { Link } from "react-router-dom"
import {
  Wallet,
  ArrowCircleDown,
  ArrowCircleUp,
  ArrowLeft,
  ArrowRight,
  Bank,
  ShieldCheck,
  CheckCircle,
  Clock,
  Coins,
  WarningCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { PageHeader } from "@/components/page-header"
import { formatCurrency } from "@/lib/mock-data"

interface Transaction {
  id: string
  type: "payout" | "withdraw" | "topup" | "escrow"
  description: string
  campaign?: string
  amount: number
  at: string
  status: "completed" | "pending"
}

const transactions: Transaction[] = [
  {
    id: "tx_001",
    type: "payout",
    description: "Payout — Fitness Transformation Series",
    campaign: "Luna Parker",
    amount: 419.1,
    at: "Apr 6, 2026 · 8:10 PM",
    status: "completed",
  },
  {
    id: "tx_002",
    type: "escrow",
    description: "Campaign escrow — My Fitness Campaign",
    amount: -5000,
    at: "Mar 25, 2026 · 10:00 AM",
    status: "completed",
  },
  {
    id: "tx_003",
    type: "topup",
    description: "Wallet top-up via Apple Pay",
    amount: 2000,
    at: "Mar 23, 2026 · 2:34 PM",
    status: "completed",
  },
  {
    id: "tx_004",
    type: "withdraw",
    description: "Withdrawal to bank · ••• 4523",
    amount: -250,
    at: "Mar 18, 2026 · 9:15 AM",
    status: "completed",
  },
  {
    id: "tx_005",
    type: "payout",
    description: "Payout — Podcast Highlights Reel (pending)",
    amount: 128.5,
    at: "Apr 9, 2026 · 11:30 AM",
    status: "pending",
  },
]

type WithdrawStep = "amount" | "review" | "success"

export function WalletPage() {
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [topupOpen, setTopupOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>("amount")
  const [txId, setTxId] = useState("")

  const balance = 1248.65
  const pendingPayouts = 541.6
  const kycCompleted = false

  const withdrawAmount = parseFloat(amount) || 0
  const canWithdraw = withdrawAmount >= 20 && withdrawAmount <= balance

  const openWithdraw = () => {
    setWithdrawStep("amount")
    setAmount("")
    setTxId("")
    setWithdrawOpen(true)
  }

  const handleWithdrawConfirm = () => {
    const id = `WD-${Date.now().toString(36).toUpperCase()}`
    setTxId(id)
    setWithdrawStep("success")
    toast.success("Withdrawal requested", {
      description: `${formatCurrency(withdrawAmount)} will arrive in 1-3 business days.`,
    })
  }

  const closeWithdraw = () => {
    setWithdrawOpen(false)
    setAmount("")
    setWithdrawStep("amount")
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Wallet & earnings"
        description="Manage your balance, fund campaigns, and withdraw to your bank."
        className="mb-6"
      />

      {/* Balance card */}
      <Card className="mb-6 overflow-hidden border-primary/30 bg-gradient-to-br from-primary/15 via-card to-card backdrop-blur">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Wallet className="size-4" weight="fill" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  Available balance
                </span>
              </div>
              <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
                {formatCurrency(balance)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Pending payouts:{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(pendingPayouts)}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setTopupOpen(true)}>
                <ArrowCircleUp className="size-4" weight="fill" />
                Top up
              </Button>
              <Button variant="outline" onClick={openWithdraw}>
                <ArrowCircleDown className="size-4" weight="fill" />
                Withdraw
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KYC + bank */}
      {!kycCompleted && (
        <Alert className="mb-6 border-warning/40 bg-warning/5">
          <WarningCircle className="size-4 text-warning" weight="fill" />
          <AlertTitle>Complete KYC to withdraw</AlertTitle>
          <AlertDescription>
            Verify your identity and link a bank account before your first
            withdrawal. Minimum withdrawal amount is $20. Earnings continue to
            accumulate until you're ready.
            <div className="mt-3 flex gap-2">
              <Button size="sm" asChild>
                <Link to="/kyc">
                  <ShieldCheck className="size-4" weight="fill" />
                  Start KYC
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/kyc">
                  <Bank className="size-4" />
                  Link bank
                </Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Transactions */}
      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Coins className="size-4 text-primary" weight="fill" />
            Transaction history
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 md:px-4 md:pb-4">
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
        </CardContent>
      </Card>

      {/* Multi-step Withdraw dialog */}
      <Dialog
        open={withdrawOpen}
        onOpenChange={(open) => {
          if (!open) closeWithdraw()
        }}
      >
        <DialogContent>
          {/* Step 1: Amount */}
          {withdrawStep === "amount" && (
            <>
              <DialogHeader>
                <DialogTitle>Withdraw to bank</DialogTitle>
                <DialogDescription>
                  Funds arrive in 1-3 business days. Minimum withdrawal is $20.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="w-amount">Amount</Label>
                  <Input
                    id="w-amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Available: {formatCurrency(balance)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                  <div className="flex items-center gap-2">
                    <Bank className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      Chase Bank ••• 4523
                    </span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={closeWithdraw}>
                  Cancel
                </Button>
                <Button
                  disabled={!canWithdraw}
                  onClick={() => setWithdrawStep("review")}
                >
                  Review
                  <ArrowRight className="size-4" />
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step 2: Review */}
          {withdrawStep === "review" && (
            <>
              <DialogHeader>
                <DialogTitle>Review withdrawal</DialogTitle>
                <DialogDescription>
                  Confirm the details below before proceeding.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-lg border border-border/60 bg-background/50 p-4 space-y-2.5">
                  <ReviewRow label="Amount" value={formatCurrency(withdrawAmount)} />
                  <ReviewRow label="Fee" value="$0.00" />
                  <Separator />
                  <ReviewRow
                    label="You'll receive"
                    value={formatCurrency(withdrawAmount)}
                    bold
                  />
                </div>
                <div className="rounded-lg border border-border/60 bg-background/50 p-4 space-y-2.5">
                  <ReviewRow label="Destination" value="Chase Bank ••• 4523" />
                  <ReviewRow label="Estimated arrival" value="1-3 business days" />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setWithdrawStep("amount")}
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
                <Button onClick={handleWithdrawConfirm}>
                  Confirm withdrawal
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Step 3: Success */}
          {withdrawStep === "success" && (
            <>
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className="flex size-16 items-center justify-center rounded-full border-2 border-success/40 bg-success/10">
                  <CheckCircle className="size-8 text-success" weight="fill" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Withdrawal submitted</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatCurrency(withdrawAmount)} is on its way to your bank
                    account.
                  </p>
                </div>
                <div className="w-full rounded-lg border border-border/60 bg-background/50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Transaction ID</span>
                    <span className="font-mono text-xs font-medium">{txId}</span>
                  </div>
                </div>
              </div>
              <DialogFooter className="sm:justify-center">
                <Button onClick={closeWithdraw}>Back to wallet</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Topup dialog */}
      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Top up wallet</DialogTitle>
            <DialogDescription>
              Add funds to your Fanvue wallet to fund campaigns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {[100, 500, 1000, 5000].map((n) => (
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
            <Button variant="ghost" onClick={() => setTopupOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success("Wallet topped up", {
                  description: `${formatCurrency(parseFloat(amount) || 0)} added to your balance.`,
                })
                setTopupOpen(false)
                setAmount("")
              }}
              disabled={!amount || parseFloat(amount) <= 0}
            >
              Confirm payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReviewRow({
  label,
  value,
  bold,
}: {
  label: string
  value: string
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  )
}
