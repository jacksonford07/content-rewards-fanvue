import { Link } from "react-router-dom";
import { TrendUp, Eye, CurrencyDollar } from "@phosphor-icons/react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTopCampaigns } from "@/queries/campaigns";
import { formatCompactNumber, formatCurrency } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export function TopCampaignsWidget({
  limit = 8,
  className,
  showHeader = true,
}: {
  limit?: number;
  className?: string;
  showHeader?: boolean;
}) {
  const { data: campaigns, isLoading } = useTopCampaigns(limit);

  return (
    <Card className={cn("border-border/60 bg-card/70", className)}>
      {showHeader && (
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendUp className="size-4 text-primary" weight="fill" />
            Top campaigns
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-2 px-3 pb-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-2 py-1.5">
              <Skeleton className="size-4" />
              <Skeleton className="size-10 rounded-md" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          ))
        ) : !campaigns || campaigns.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No campaign activity yet. Once clips rack up views, top campaigns
            will appear here.
          </p>
        ) : (
          campaigns.map((c, i) => (
            <Link
              key={c.id}
              to={`/campaigns/${c.id}`}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
            >
              <RankBadge rank={i + 1} />
              {c.sourceThumbnailUrl ? (
                <img
                  src={c.sourceThumbnailUrl}
                  alt={c.title}
                  className="size-10 shrink-0 rounded-md object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="size-10 shrink-0 rounded-md bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{c.title}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {c.creator ? `@${c.creator.handle}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="flex items-center justify-end gap-0.5 text-xs font-semibold tabular-nums text-primary">
                  <CurrencyDollar className="size-3" weight="bold" />
                  {formatCurrency(c.rewardRatePer1k).replace("$", "")}
                </p>
                <p className="flex items-center justify-end gap-0.5 text-[10px] tabular-nums text-muted-foreground">
                  <Eye className="size-2.5" />
                  {formatCompactNumber(c.totalViews)}
                </p>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors =
    rank === 1
      ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white"
      : rank === 2
        ? "bg-gradient-to-br from-slate-300 to-slate-400 text-white"
        : rank === 3
          ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white"
          : "bg-muted text-muted-foreground";
  return (
    <div
      className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${colors}`}
    >
      {rank}
    </div>
  );
}
