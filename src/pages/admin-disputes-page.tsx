import { useState } from "react"
import {
  CheckCircle,
  Warning,
  XCircle,
  ArrowSquareOut,
  ChatCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { formatCurrency, timeAgo } from "@/lib/mock-data"
import { useDisputes, useResolveDispute } from "@/queries/admin"
import { payoutMethodLabel, type PayoutMethod } from "@/lib/payout-validators"

type Filter = "open" | "resolved" | "all"

export function AdminDisputesPage() {
  const [filter, setFilter] = useState<Filter>("open")
  const { data, isLoading, isError, error } = useDisputes(filter)
  const resolve = useResolveDispute()

  const handleResolve = async (
    id: string,
    resolution: "confirmed" | "rejected",
  ) => {
    try {
      await resolve.mutateAsync({ id, resolution })
      toast.success(
        resolution === "confirmed"
          ? "Dispute resolved — payment confirmed"
          : "Dispute resolved — payment rejected",
      )
    } catch {
      toast.error("Couldn't resolve dispute")
    }
  }

  if (
    isError &&
    (error as { response?: { status?: number } } | undefined)?.response
      ?.status === 403
  ) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12 text-center">
        <h1 className="text-xl font-semibold">Admin only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account isn't on the admin list. Contact Jackson if you need
          access.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Dispute admin queue"
        description="Review off-platform payout disputes raised by clippers. Resolving 'confirmed' sides with the creator (payment did happen); 'rejected' sides with the clipper."
        className="mb-6"
      />

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))
        ) : !data?.length ? (
          <Card className="border-dashed border-border/60 bg-muted/30">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {filter === "open"
                ? "No open disputes. Quiet day."
                : "Nothing here."}
            </CardContent>
          </Card>
        ) : (
          data.map((row) => (
            <Card key={row.id} className="border-border/60 bg-card/70">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {row.campaign.title}{" "}
                      <span className="text-muted-foreground">·</span>{" "}
                      <span className="tabular-nums text-primary">
                        {formatCurrency(row.amountCents / 100)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {payoutMethodLabel(row.method as PayoutMethod)} ·
                      Disputed{" "}
                      {row.disputedAt
                        ? timeAgo(row.disputedAt)
                        : "(unknown time)"}
                    </p>
                  </div>
                  {row.disputeResolution ? (
                    <Badge
                      variant="outline"
                      className={
                        row.disputeResolution === "confirmed"
                          ? "border-success/40 bg-success/10 text-success"
                          : "border-destructive/40 bg-destructive/10 text-destructive"
                      }
                    >
                      {row.disputeResolution === "confirmed"
                        ? "Resolved · Confirmed"
                        : "Resolved · Rejected"}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-warning/40 bg-warning/10 text-warning"
                    >
                      <Warning weight="fill" className="size-3" /> Open
                    </Badge>
                  )}
                </div>

                <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Creator</p>
                    <p>
                      {row.creator.displayName} @{row.creator.handle}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Clipper</p>
                    <p>
                      {row.clipper.displayName} @{row.clipper.handle}
                    </p>
                    {row.clipper.contactChannel && row.clipper.contactValue && (
                      <p className="flex items-center gap-1">
                        <ChatCircle className="size-3" />
                        {row.clipper.contactChannel}:{" "}
                        {row.clipper.contactValue}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">
                      Recipient claimed
                    </p>
                    <p className="break-all font-mono text-[11px]">
                      {row.valueSnapshot}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">Reference</p>
                    <p>{row.reference || "—"}</p>
                  </div>
                </div>

                {row.disputeReason && (
                  <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-xs">
                    <p className="font-medium text-foreground">
                      Clipper's reason
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                      {row.disputeReason}
                    </p>
                  </div>
                )}

                {row.txHash && (
                  <a
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                    href={
                      row.method === "btc"
                        ? `https://mempool.space/tx/${row.txHash}`
                        : row.method === "sol" ||
                            row.method === "usdc_sol"
                          ? `https://solscan.io/tx/${row.txHash}`
                          : `https://etherscan.io/tx/${row.txHash}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ArrowSquareOut className="size-3" />
                    Verify on explorer
                  </a>
                )}

                <a
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                  href={row.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ArrowSquareOut className="size-3" />
                  View post
                </a>

                {!row.disputeResolution && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleResolve(row.id, "confirmed")}
                      disabled={resolve.isPending}
                    >
                      <CheckCircle weight="fill" className="size-3.5" />
                      Resolved · Confirmed
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleResolve(row.id, "rejected")}
                      disabled={resolve.isPending}
                    >
                      <XCircle weight="fill" className="size-3.5" />
                      Resolved · Rejected
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
