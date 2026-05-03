import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle,
  CurrencyDollar,
  ChatCircle,
  ArrowSquareOut,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  payoutMethodLabel,
  validatePayoutMethod,
  type PayoutMethod,
} from "@/lib/payout-validators"
import { formatCurrency } from "@/lib/mock-data"
import { useMarkPaid, usePayoutContext } from "@/queries/submissions"

interface Props {
  submissionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CRYPTO_METHODS: PayoutMethod[] = [
  "eth",
  "usdc_eth",
  "sol",
  "usdc_sol",
  "btc",
]

function explorerUrl(method: PayoutMethod, txHash: string): string | null {
  const h = txHash.trim()
  if (!h) return null
  if (method === "eth" || method === "usdc_eth") {
    return `https://etherscan.io/tx/${h}`
  }
  if (method === "sol" || method === "usdc_sol") {
    return `https://solscan.io/tx/${h}`
  }
  if (method === "btc") {
    return `https://mempool.space/tx/${h}`
  }
  return null
}

function txHashShape(method: PayoutMethod, value: string): string | null {
  const v = value.trim()
  if (!v) return null
  if (method === "eth" || method === "usdc_eth") {
    return /^0x[a-fA-F0-9]{64}$/.test(v) ? null : "Expect 0x + 64 hex characters"
  }
  if (method === "sol" || method === "usdc_sol") {
    // Solana tx hash is base58, 87–88 chars typically.
    return /^[1-9A-HJ-NP-Za-km-z]{43,88}$/.test(v)
      ? null
      : "Expect base58, 43–88 characters"
  }
  if (method === "btc") {
    return /^[a-fA-F0-9]{64}$/.test(v) ? null : "Expect 64 hex characters"
  }
  return null
}

export function MarkPaidDialog({ submissionId, open, onOpenChange }: Props) {
  const { data: ctx, isLoading } = usePayoutContext(open ? submissionId : null)
  const markPaid = useMarkPaid()

  const [method, setMethod] = useState<PayoutMethod | "">("")
  const [value, setValue] = useState("")
  const [reference, setReference] = useState("")
  const [txHash, setTxHash] = useState("")

  const overlap = ctx?.overlapMethods ?? []
  const isCrypto = method ? CRYPTO_METHODS.includes(method) : false

  // Pre-fill method + value when context loads or method changes.
  useEffect(() => {
    if (!open || !ctx) return
    if (overlap.length === 0) return
    setMethod((prev) => (prev || overlap[0]) as PayoutMethod)
  }, [open, ctx, overlap])

  useEffect(() => {
    if (!ctx || !method) return
    const saved = ctx.clipperSavedMethods.find((m) => m.method === method)
    if (saved) setValue(saved.value)
  }, [method, ctx])

  // Reset form when dialog closes.
  useEffect(() => {
    if (!open) {
      setMethod("")
      setValue("")
      setReference("")
      setTxHash("")
    }
  }, [open])

  const valueError = useMemo(() => {
    if (!method || !value.trim()) return null
    const r = validatePayoutMethod(method, value)
    return r.valid ? null : r.error
  }, [method, value])

  const txHashError = useMemo(() => {
    if (!method) return null
    return txHashShape(method, txHash)
  }, [method, txHash])

  const formValid =
    !!method && value.trim().length > 0 && !valueError && !txHashError

  const handleSubmit = async () => {
    if (!submissionId || !formValid || !method) return
    try {
      await markPaid.mutateAsync({
        id: submissionId,
        method,
        value: value.trim(),
        reference: reference.trim() || undefined,
        txHash: txHash.trim() || undefined,
      })
      toast.success("Marked paid", {
        description:
          "We've notified the clipper. Trust score updates after they confirm receipt.",
      })
      onOpenChange(false)
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined
      toast.error(msg ?? "Failed to mark paid")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CurrencyDollar weight="fill" className="size-5 text-primary" />
            Mark paid
          </DialogTitle>
          <DialogDescription>
            Record an off-platform payment. We notify the clipper to confirm
            receipt; the trust score updates once they do.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !ctx ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                {ctx.clipper.displayName}{" "}
                <span className="text-muted-foreground">@{ctx.clipper.handle}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Accrued payout:{" "}
                <strong className="text-foreground tabular-nums">
                  {formatCurrency(ctx.submission.payoutAmountCents / 100)}
                </strong>
              </p>
            </div>

            {ctx.clipper.contactChannel && ctx.clipper.contactValue && (
              <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/50 p-3 text-xs">
                <ChatCircle className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">
                    {ctx.clipper.contactChannel}
                  </p>
                  <p className="text-muted-foreground">
                    {ctx.clipper.contactValue}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Use this to confirm payout details out-of-band before
                    sending.
                  </p>
                </div>
              </div>
            )}

            {overlap.length === 0 ? (
              <div className="rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
                <p className="font-medium text-warning">No overlapping methods</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This clipper hasn't saved any of the payout methods this
                  campaign accepts. They need to update their payout
                  settings before you can mark this paid.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Method</Label>
                  <Select
                    value={method}
                    onValueChange={(v) => setMethod(v as PayoutMethod)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a method" />
                    </SelectTrigger>
                    <SelectContent>
                      {overlap.map((m) => (
                        <SelectItem key={m} value={m}>
                          {payoutMethodLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Recipient value</Label>
                  <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    aria-invalid={!!valueError || undefined}
                    className={valueError ? "border-destructive" : ""}
                  />
                  {valueError && (
                    <p className="text-xs text-destructive">{valueError}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Pre-filled from the clipper's saved value. Edit if you
                    received an updated address out-of-band.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Reference{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="PayPal transaction ID, bank ref…"
                  />
                </div>

                {isCrypto && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">
                      Transaction hash{" "}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      placeholder={
                        method === "eth" || method === "usdc_eth"
                          ? "0x…"
                          : method === "sol" || method === "usdc_sol"
                            ? "Solana tx signature"
                            : "BTC tx hash"
                      }
                      aria-invalid={!!txHashError || undefined}
                      className={txHashError ? "border-destructive" : ""}
                    />
                    {txHashError && (
                      <p className="text-xs text-destructive">{txHashError}</p>
                    )}
                    {method &&
                      txHash.trim() &&
                      !txHashError &&
                      explorerUrl(method, txHash) && (
                        <a
                          href={explorerUrl(method, txHash) ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary underline-offset-4 hover:underline"
                        >
                          <ArrowSquareOut className="size-3" />
                          View on explorer
                        </a>
                      )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            disabled={markPaid.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={!formValid || markPaid.isPending || overlap.length === 0}
            loading={markPaid.isPending}
            onClick={handleSubmit}
          >
            <CheckCircle weight="fill" className="size-4" />
            Mark paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
