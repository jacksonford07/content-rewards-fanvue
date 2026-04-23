import { Navigate, useParams } from "react-router-dom"

import { Skeleton } from "@/components/ui/skeleton"
import { NotFoundCard } from "@/components/not-found-card"
import { useCampaignBySlug } from "@/queries/campaigns"

export function CampaignBySlugPage() {
  const { slug } = useParams()
  const { data: campaign, isError, isLoading } = useCampaignBySlug(slug)

  if (isError) {
    return (
      <NotFoundCard
        title="Campaign link invalid"
        description="This private campaign link is incorrect or has been revoked. Ask the creator for a fresh link."
        backTo="/"
        backLabel="Back to hub"
      />
    )
  }

  if (isLoading || !campaign) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <Skeleton className="h-4 w-48 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="aspect-video w-full rounded-lg" />
        </div>
      </div>
    )
  }

  // Reuse the existing detail page by redirecting to /campaigns/:id
  return <Navigate to={`/campaigns/${campaign.id}`} replace />
}
