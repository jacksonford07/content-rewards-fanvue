import { Trophy, Eye, CurrencyDollar } from "@phosphor-icons/react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { useTopClippers } from "@/queries/campaigns"
import { formatCompactNumber, formatCurrency } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export function TopClippersWidget({
  limit = 8,
  className,
  showHeader = true,
}: {
  limit?: number
  className?: string
  showHeader?: boolean
}) {
  const { data: clippers, isLoading } = useTopClippers(limit)

  return (
    <Card
      className={cn(
        "border-border/60 bg-card/70",
        className,
      )}
    >
      {showHeader && (
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Trophy className="size-4 text-primary" weight="fill" />
            Top clippers
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-2 px-3 pb-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-1.5">
              <Skeleton className="size-4" />
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-2.5 w-14" />
              </div>
            </div>
          ))
        ) : !clippers || clippers.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No clipper activity yet. Once clippers submit and earn, they'll show
            up here.
          </p>
        ) : (
          clippers.map((clipper, i) => (
            <div
              key={clipper.id}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
            >
              <RankBadge rank={i + 1} />
              <Avatar className="size-8 shrink-0">
                <AvatarImage src={clipper.avatarUrl} />
                <AvatarFallback>{clipper.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{clipper.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  @{clipper.handle}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="flex items-center justify-end gap-0.5 text-xs font-semibold tabular-nums text-primary">
                  <CurrencyDollar className="size-3" weight="bold" />
                  {formatCurrency(clipper.earnings).replace("$", "")}
                </p>
                <p className="flex items-center justify-end gap-0.5 text-[10px] tabular-nums text-muted-foreground">
                  <Eye className="size-2.5" />
                  {formatCompactNumber(clipper.totalViews)}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const colors =
    rank === 1
      ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white"
      : rank === 2
        ? "bg-gradient-to-br from-slate-300 to-slate-400 text-white"
        : rank === 3
          ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white"
          : "bg-muted text-muted-foreground"
  return (
    <div
      className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${colors}`}
    >
      {rank}
    </div>
  )
}
