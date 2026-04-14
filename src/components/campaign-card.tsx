import { Link } from "react-router-dom"
import { ArrowRight, Users, Eye, CurrencyDollar } from "@phosphor-icons/react"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { PlatformIcon } from "@/components/platform-icon"
import type { Campaign } from "@/lib/types"
import { formatCompactNumber, formatCurrency } from "@/lib/mock-data"

interface CampaignCardProps {
  campaign: Campaign
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const budgetRemaining = campaign.totalBudget - campaign.budgetSpent
  const budgetPct = Math.min(
    100,
    Math.round((campaign.budgetSpent / campaign.totalBudget) * 100)
  )

  return (
    <Link to={`/campaigns/${campaign.id}`} className="group block h-full">
      <Card className="h-full card-glow overflow-hidden border-border/60 bg-card/70 backdrop-blur transition-all group-hover:border-primary/50">
        <div className="relative aspect-video overflow-hidden bg-muted">
          <img
            src={campaign.sourceThumbnailUrl}
            alt={campaign.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold backdrop-blur-md">
            <CurrencyDollar className="size-3 text-primary" weight="bold" />
            <span className="tabular-nums">
              {formatCurrency(campaign.rewardRatePer1k)} / 1K
            </span>
          </div>
          <div className="absolute bottom-3 right-3 flex items-center gap-1">
            {campaign.allowedPlatforms.map((p) => (
              <span
                key={p}
                className="flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground backdrop-blur-md"
              >
                <PlatformIcon platform={p} className="size-3" />
              </span>
            ))}
          </div>
        </div>

        <CardContent className="flex flex-col gap-3 px-4 pt-4">
          <div className="flex items-center gap-2">
            <Avatar className="size-6 ring-1 ring-border">
              <AvatarImage src={campaign.creator.avatarUrl} />
              <AvatarFallback>{campaign.creator.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs text-muted-foreground">
              @{campaign.creator.handle}
            </span>
          </div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {campaign.title}
          </h3>
          <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">
            {campaign.description}
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 px-4 pb-4 pt-0">
          <div className="flex w-full items-center justify-between text-xs">
            <div className="flex items-center gap-3 text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="size-3" />
                {campaign.activeClippers}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="size-3" />
                {formatCompactNumber(campaign.totalViews)}
              </span>
            </div>
            <span className="text-foreground font-medium tabular-nums">
              {formatCurrency(budgetRemaining)} left
            </span>
          </div>
          <Progress value={budgetPct} className="h-1.5" />
          <div className="flex w-full items-center justify-between text-[11px] text-muted-foreground">
            <span>{budgetPct}% spent</span>
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              View brief
              <ArrowRight className="size-3" weight="bold" />
            </span>
          </div>
        </CardFooter>
      </Card>
    </Link>
  )
}
