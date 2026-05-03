import { Link, useParams } from "react-router-dom"
import { useEffect, useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowLeft,
  ArrowSquareOut,
  CloudArrowDown,
  Eye,
  Users,
  CurrencyDollar,
  Timer,
  CheckCircle,
  SealCheck,
  Info,
  PlayCircle,
  Lightning,
  Clock,
  XCircle,
  ListChecks,
  Prohibit,
  Lock,
  Copy,
  Check,
  VideoCamera,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
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
import { Checkbox } from "@/components/ui/checkbox"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { PlatformIcon } from "@/components/platform-icon"
import {
  formatCompactNumber,
  formatCurrency,
  platformLabels,
  timeAgo,
  timeUntil,
} from "@/lib/mock-data"
import { useCampaign, useCampaignSourceStatus } from "@/queries/campaigns"
import { useMySubmissions, useSubmitClip } from "@/queries/submissions"
import { usePayoutSettings } from "@/queries/payout-methods"
import { payoutMethodLabel } from "@/lib/payout-validators"
import { TrustBadge } from "@/components/trust-badge"
import { QK } from "@/lib/query-keys"
import { NotFoundCard } from "@/components/not-found-card"
import { useAuth } from "@/hooks/use-auth"
import type { Platform } from "@/lib/types"
import { cn } from "@/lib/utils"

export function CampaignDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [submitOpen, setSubmitOpen] = useState(false)
  const [postUrl, setPostUrl] = useState("")
  const [platform, setPlatform] = useState<Platform | "">("")
  const [acked, setAcked] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const { data: campaign, isError: campaignError } = useCampaign(id)
  const { data: payoutSettings } = usePayoutSettings()
  const { data: myResp } = useMySubmissions({
    tab: "all",
    page: 1,
    limit: 100,
    campaignId: id,
  })
  const myClips = myResp?.data ?? []

  const submitMutation = useSubmitClip()
  const submitting = submitMutation.isPending

  // Auto-detect platform from URL
  const detectedPlatform: Platform | null = useMemo(() => {
    const u = postUrl.toLowerCase()
    if (!u) return null
    if (u.includes("tiktok.com")) return "tiktok"
    if (u.includes("instagram.com")) return "instagram"
    if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube"
    return null
  }, [postUrl])

  // Auto-select platform when detected
  useEffect(() => {
    if (detectedPlatform && campaign?.allowedPlatforms.includes(detectedPlatform)) {
      setPlatform(detectedPlatform)
    }
  }, [detectedPlatform, campaign?.allowedPlatforms])

  // URL validation: must be a valid URL and match allowed platforms
  const urlError: string | null = useMemo(() => {
    if (!postUrl.trim()) return null
    try {
      new URL(postUrl)
    } catch {
      return "Paste a valid URL"
    }
    if (!detectedPlatform) return "URL must be from TikTok, Instagram, or YouTube"
    if (campaign && !campaign.allowedPlatforms.includes(detectedPlatform))
      return `${platformLabels[detectedPlatform]} isn't allowed for this campaign`
    if (platform && detectedPlatform && platform !== detectedPlatform)
      return `URL is from ${platformLabels[detectedPlatform]}, but you selected ${platformLabels[platform as Platform]}`
    return null
  }, [postUrl, detectedPlatform, campaign, platform])

  // M2.3 — overlap check between creator's accepted methods and the
  // clipper's saved methods. Empty acceptedPayoutMethods means legacy
  // campaign with no constraint (treat as overlap-OK).
  const clipperMethods = payoutSettings?.methods.map((m) => m.method) ?? []
  const campaignMethods = campaign?.acceptedPayoutMethods ?? []
  const hasMethodOverlap =
    campaignMethods.length === 0 ||
    campaignMethods.some((m) => clipperMethods.includes(m))
  const missingMethodsHint =
    campaignMethods.length === 0
      ? null
      : campaignMethods.map((m) => payoutMethodLabel(m)).join(", ")

  const formValid =
    postUrl.trim() && platform && acked && !urlError && hasMethodOverlap

  // Extract Google Drive file ID from URL
  const driveFileId = useMemo(() => {
    const url = campaign?.sourceContentUrl ?? ""
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
    return match?.[1] ?? null
  }, [campaign?.sourceContentUrl])

  // Backend probes the Drive file (HEAD + cached 5 min) so the UI can swap
  // the embed/download CTA for a helpful placeholder when the source was
  // removed or had its permissions revoked.
  const { data: sourceStatus, isLoading: sourceStatusLoading } =
    useCampaignSourceStatus(campaign?.id)
  const sourceMissing = sourceStatus?.available === false
  const sourceChecking = sourceStatusLoading || sourceStatus === undefined

  if (campaignError) {
    return (
      <NotFoundCard
        title="Campaign not found"
        description="This campaign may have been removed, paused by the creator, or the link is outdated."
        backTo="/"
        backLabel="Back to hub"
      />
    )
  }

  if (!campaign) return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      {/* Breadcrumb + Back */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-10" />
          <span className="text-muted-foreground">/</span>
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-8 w-20" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          {/* Hero video card */}
          <Card className="overflow-hidden border-border/60 bg-card/70 p-0 backdrop-blur">
            <Skeleton className="aspect-video w-full rounded-none" />
          </Card>

          {/* Title + status */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
            <Skeleton className="h-4 w-4/5" />
          </div>

          {/* Creator row */}
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardContent className="flex items-center gap-3 p-4">
              <Skeleton className="size-11 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-28" />
              </div>
            </CardContent>
          </Card>

          {/* Requirements card */}
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader>
              <Skeleton className="h-5 w-44" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 rounded-lg border border-border/60 bg-background/50 p-4">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Source content card */}
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader>
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background/50 p-4 sm:flex-row sm:items-center">
                <Skeleton className="h-20 w-32 shrink-0 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-full max-w-sm" />
                </div>
                <Skeleton className="h-8 w-32" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card backdrop-blur">
            <CardContent className="space-y-4 p-6">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-40" />
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="space-y-2 rounded-lg border border-border/60 bg-background/40 p-3"
                  >
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-5 w-10" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-11 w-full rounded-md" />
              <Skeleton className="mx-auto h-3 w-40" />
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardContent className="space-y-3 p-5">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-44" />
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )

  const reserved = campaign.budgetReserved ?? 0
  const budgetAvailable =
    campaign.budgetAvailable ??
    Math.max(campaign.totalBudget - campaign.budgetSpent - reserved, 0)
  const budgetRemaining = campaign.totalBudget - campaign.budgetSpent
  const isBannedFromCampaign = myClips.some((c) => c.isBanned)
  const banReason = myClips.find((c) => c.isBanned)?.rejectionReason
  const isOwner = user?.id === campaign.creator.id
  const viewerIsCreatorRole = user?.role === "creator"
  const canSubmit =
    campaign.status === "active" &&
    budgetAvailable > 0 &&
    !isBannedFromCampaign &&
    !viewerIsCreatorRole &&
    !sourceMissing &&
    !sourceChecking &&
    hasMethodOverlap
  const shareUrl = campaign.privateSlug
    ? `${window.location.origin}/c/${campaign.privateSlug}`
    : null
  const spentPct = campaign.totalBudget
    ? Math.min(100, Math.round((campaign.budgetSpent / campaign.totalBudget) * 100))
    : 0
  const reservedPct = campaign.totalBudget
    ? Math.min(100 - spentPct, Math.round((reserved / campaign.totalBudget) * 100))
    : 0

  const payoutTiers = (() => {
    const rate = campaign.rewardRatePer1k
    if (rate <= 0) return [] as { views: number; payout: number; isMax?: boolean }[]
    const maxSinglePayout = Math.max(
      0,
      campaign.maxPayoutPerClip
        ? Math.min(campaign.maxPayoutPerClip, budgetRemaining)
        : budgetRemaining
    )
    const maxViewsRaw = (maxSinglePayout / rate) * 1000
    if (maxViewsRaw < 1000) return []
    const roundStep = maxViewsRaw >= 100_000 ? 5000 : maxViewsRaw >= 10_000 ? 1000 : 500
    const roundDown = (v: number) => Math.max(roundStep, Math.floor(v / roundStep) * roundStep)
    const tier1Views = roundDown(maxViewsRaw * 0.25)
    const tier2Views = roundDown(maxViewsRaw * 0.5)
    const smaller = Array.from(new Set([tier1Views, tier2Views]))
      .filter((v) => v < maxViewsRaw)
      .sort((a, b) => a - b)
      .map((views) => ({ views, payout: (views / 1000) * rate, isMax: false }))
    return [
      ...smaller,
      { views: Math.round(maxViewsRaw), payout: maxSinglePayout, isMax: true },
    ]
  })()

  const handleSubmit = async () => {
    if (!campaign) return
    try {
      await submitMutation.mutateAsync({
        campaignId: campaign.id,
        postUrl,
        platform: platform as Platform,
      })
      setSubmitOpen(false)
      setPostUrl("")
      setPlatform("")
      setAcked(false)
      toast.success("Submission received", {
        description:
          "The creator has 48 hours to review your clip. If not reviewed, it will be auto-approved.",
      })
      qc.invalidateQueries({ queryKey: [QK.submissions.mine] })
    } catch {
      toast.error("Failed to submit clip")
    }
  }

  // B1: route the breadcrumb / Back link based on whether the viewer owns
  // the campaign. Creators land here from "My campaigns" and expect to
  // bounce back there; clippers land from the hub.
  const viewerOwnsCampaign = user?.id === campaign.creator?.id
  const backHref = viewerOwnsCampaign ? "/creator/campaigns" : "/"
  const backLabel = viewerOwnsCampaign ? "My campaigns" : "Hub"

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex items-center justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={backHref}>{backLabel}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[240px] truncate">
                {campaign.title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Button variant="ghost" size="sm" asChild>
          <Link to={backHref}>
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
      </div>

      {isBannedFromCampaign && (
        <Alert className="mb-6 border-destructive/40 bg-destructive/10">
          <Prohibit className="size-4 text-destructive" weight="bold" />
          <AlertTitle className="text-destructive">
            You're banned from this campaign
          </AlertTitle>
          <AlertDescription>
            The creator has banned you from participating. New submissions won't
            be accepted.
            {banReason && (
              <>
                {" "}
                <span className="font-medium">Reason:</span> {banReason}
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main content */}
        <div className="min-w-0 space-y-6">
          {/* Hero video card */}
          <Card className="overflow-hidden border-border/60 bg-card/70 p-0 backdrop-blur">
            <div className="relative aspect-video w-full overflow-hidden bg-black">
              {isBannedFromCampaign || campaign.status !== "active" ? (
                <>
                  <img
                    src={campaign.sourceThumbnailUrl}
                    alt={campaign.title}
                    className="h-full w-full object-cover opacity-60"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1.5 border px-3 py-1.5 text-sm font-medium backdrop-blur",
                        isBannedFromCampaign
                          ? "border-destructive/50 bg-destructive/20 text-destructive"
                          : campaign.status === "paused"
                            ? "border-warning/50 bg-warning/20 text-warning"
                            : "border-border bg-background/80 text-muted-foreground",
                      )}
                    >
                      {isBannedFromCampaign ? (
                        <>
                          <Prohibit weight="bold" className="size-4" />
                          Banned from campaign
                        </>
                      ) : campaign.status === "paused" ? (
                        <>
                          <Clock weight="fill" className="size-4" />
                          Campaign paused
                        </>
                      ) : (
                        <>
                          <CheckCircle weight="fill" className="size-4" />
                          Campaign ended
                        </>
                      )}
                    </Badge>
                  </div>
                </>
              ) : driveFileId ? (
                sourceChecking ? (
                  <div className="flex h-full w-full items-center justify-center bg-muted/40">
                    <div className="size-8 animate-spin rounded-full border-2 border-primary/60 border-t-transparent" />
                  </div>
                ) : sourceMissing ? (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/40 p-6 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <VideoCamera weight="duotone" className="size-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold">Source video unavailable</p>
                      <p className="max-w-sm text-xs text-muted-foreground">
                        The creator removed the source file from Google Drive or changed its
                        permissions. Ask the creator for a new link before submitting a clip.
                      </p>
                    </div>
                  </div>
                ) : (
                  <iframe
                    src={`https://drive.google.com/file/d/${driveFileId}/preview`}
                    className="h-full w-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    referrerPolicy="no-referrer"
                  />
                )
              ) : (
                <>
                  <img
                    src={campaign.sourceThumbnailUrl}
                    alt={campaign.title}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <a
                      href={campaign.sourceContentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex size-16 items-center justify-center rounded-full bg-background/90 shadow-2xl backdrop-blur transition-transform hover:scale-110"
                    >
                      <PlayCircle weight="fill" className="size-10 text-primary" />
                    </a>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Title + status */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
                  {campaign.title}
                </h1>
                {campaign.status === "active" && budgetAvailable <= 0 ? (
                  <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                    <Lock weight="fill" className="size-3" />
                    Funds exhausted
                  </Badge>
                ) : campaign.status === "active" ? (
                  <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                    <Lightning weight="fill" className="size-3" />
                    Live
                  </Badge>
                ) : campaign.status === "paused" ? (
                  <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning">
                    Paused
                  </Badge>
                ) : campaign.status === "completed" ? (
                  <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
                    Completed
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {campaign.description}
              </p>
            </div>
          </div>

          {/* Creator card */}
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-10 ring-2 ring-primary/20">
                  <AvatarImage src={campaign.creator.avatarUrl} />
                  <AvatarFallback>
                    {campaign.creator.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold">
                      {campaign.creator.name}
                    </p>
                    {campaign.creator.verified && (
                      <SealCheck
                        weight="fill"
                        className="size-4 text-primary"
                      />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    @{campaign.creator.handle} ·{" "}
                    {formatCompactNumber(campaign.creator.followers ?? 0)}{" "}
                    followers
                  </p>
                </div>
              </div>
              <TrustBadge
                trust={campaign.creator.trust}
                side="creator"
                variant="detail"
              />
            </CardContent>
          </Card>

          {/* Requirements */}
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="size-4 text-primary" />
                Campaign requirements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {campaign.requirementsType === "native" ? (
                <div
                  className="rounded-lg border border-border/60 bg-background/50 p-4 text-sm leading-relaxed text-foreground/90 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h1:first-child]:mt-0 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2:first-child]:mt-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_li]:my-0.5 [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_u]:underline"
                  dangerouslySetInnerHTML={{ __html: campaign.requirementsText ?? "" }}
                />
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      Full brief on Google Docs
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Opens externally in a new tab
                    </p>
                  </div>
                  <Button size="sm" asChild>
                    <a
                      href={campaign.requirementsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View full brief
                      <ArrowSquareOut className="size-3.5" />
                    </a>
                  </Button>
                </div>
              )}

              <Separator className="my-4" />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Allowed platforms
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {campaign.allowedPlatforms.map((p) => (
                      <Badge
                        key={p}
                        variant="outline"
                        className="gap-1.5 border-border/70"
                      >
                        <PlatformIcon platform={p} />
                        {platformLabels[p]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Minimum views to submit
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {formatCompactNumber(campaign.minPayoutThreshold)} views on
                    your clip
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Source content — hidden for paused/completed campaigns and banned clippers */}
          {campaign.status === "active" && !isBannedFromCampaign && (
            <Card className="border-border/60 bg-card/70 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CloudArrowDown className="size-4 text-primary" />
                  Source content
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sourceChecking ? (
                  <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background/50 p-4 sm:flex-row sm:items-center">
                    <Skeleton className="h-20 w-32 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-full max-w-sm" />
                    </div>
                    <Skeleton className="h-8 w-32" />
                  </div>
                ) : sourceMissing ? (
                  <div className="flex flex-col gap-4 rounded-lg border border-dashed border-border/60 bg-background/50 p-4 sm:flex-row sm:items-center">
                    <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <VideoCamera weight="duotone" className="size-8" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        Source video unavailable
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        The creator removed this file or changed its Drive
                        permissions. Download is disabled until a new link is
                        published.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" disabled>
                      Download unavailable
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background/50 p-4 sm:flex-row sm:items-center">
                    <img
                      src={campaign.sourceThumbnailUrl}
                      alt="Source thumbnail"
                      className="h-20 w-32 shrink-0 rounded-lg object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        Original video hosted on Google Drive
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {campaign.sourceContentUrl}
                      </p>
                    </div>
                    <Button size="sm" asChild>
                      <a
                        href={campaign.sourceContentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Download source
                        <CloudArrowDown className="size-4" />
                      </a>
                    </Button>
                  </div>
                )}
                {!sourceChecking && !sourceMissing && (
                  <Alert className="mt-4 border-warning/30 bg-warning/10">
                    <Info className="size-4 text-warning" />
                    <AlertTitle className="text-warning">Heads up</AlertTitle>
                    <AlertDescription>
                      Don't reupload source files or share credentials. Use this
                      material only to produce short-form clips within this
                      campaign's rules.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* My submissions for this campaign */}
          {myClips.length > 0 && (
            <Card className="border-border/60 bg-card/70 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="size-4 text-primary" />
                  My submissions ({myClips.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {myClips.map((clip) => (
                  <div
                    key={clip.id}
                    className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/40 p-3 md:flex-row md:items-center md:gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <ClipStatusBadge status={clip.status} isBanned={clip.isBanned} />
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(clip.submittedAt)}
                        </span>
                      </div>
                      {clip.status === "pending" && clip.autoApproveAt && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          Auto-approves in {timeUntil(clip.autoApproveAt)}
                        </p>
                      )}
                      {clip.status === "paid" && clip.payoutAmount && (
                        <p className="mt-1 text-sm font-semibold text-primary">
                          +{formatCurrency(clip.payoutAmount)}
                        </p>
                      )}
                      {clip.status === "rejected" && clip.rejectionReason && (
                        <div className="mt-2 w-fit max-w-full rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs text-destructive">
                          <span className="font-medium">
                            {clip.isBanned ? "Banned — reason:" : "Reason:"}
                          </span>{" "}
                          {clip.rejectionReason}
                        </div>
                      )}
                    </div>
                    {clip.viewsAtDay30 != null && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Eye className="size-3" />
                        {formatCompactNumber(clip.viewsAtDay30)} views
                      </div>
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <a href={clip.postUrl} target="_blank" rel="noopener noreferrer">
                        View
                        <ArrowSquareOut className="size-3" />
                      </a>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card backdrop-blur">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-wide text-primary/80">
                Reward rate
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tight text-foreground tabular-nums">
                  {formatCurrency(campaign.rewardRatePer1k)}
                </span>
                <span className="text-sm text-muted-foreground">
                  / 1,000 views
                </span>
              </div>

              {campaign.maxPayoutPerClip && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Max{" "}
                  <span className="text-foreground font-medium">
                    {formatCurrency(campaign.maxPayoutPerClip)}
                  </span>{" "}
                  per clip
                </p>
              )}

              <Separator className="my-4" />

              <div className="space-y-3 text-sm">
                <Row
                  label="Budget available"
                  value={formatCurrency(budgetAvailable)}
                />
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 bg-primary"
                    style={{ width: `${spentPct}%` }}
                  />
                  <div
                    className="absolute inset-y-0 bg-primary/40"
                    style={{ left: `${spentPct}%`, width: `${reservedPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(budgetAvailable)} available of{" "}
                  {formatCurrency(campaign.totalBudget)}
                </p>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <StatMini
                  icon={<Users className="size-4" />}
                  value={campaign.activeClippers.toString()}
                  label="Clippers"
                />
                <StatMini
                  icon={<Eye className="size-4" />}
                  value={formatCompactNumber(campaign.totalViews)}
                  label="Total views"
                />
                <StatMini
                  icon={<Timer className="size-4" />}
                  value="48h"
                  label="Review window"
                />
                <StatMini
                  icon={<CheckCircle className="size-4" />}
                  value={campaign.totalSubmissions.toString()}
                  label="Submissions"
                />
              </div>

              {viewerIsCreatorRole ? (
                isOwner ? null : (
                  <div className="mt-6 rounded-lg border border-border/60 bg-muted/40 p-4 text-center">
                    <p className="text-sm font-medium">Creator view</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Clippers submit clips here — creators just browse for
                      inspiration.
                    </p>
                  </div>
                )
              ) : (
                <>
                  {!hasMethodOverlap && missingMethodsHint && (
                    <Alert className="mt-6 border-warning/40 bg-warning/5">
                      <Info className="size-4 text-warning" />
                      <AlertTitle>You can't submit yet</AlertTitle>
                      <AlertDescription>
                        This creator pays in <strong>{missingMethodsHint}</strong>.
                        Add one of these to your{" "}
                        <Link
                          to="/settings/payout"
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          payout settings
                        </Link>{" "}
                        to submit.
                      </AlertDescription>
                    </Alert>
                  )}
                  <Button
                    className="mt-6 w-full"
                    size="lg"
                    disabled={!canSubmit}
                    onClick={() => setSubmitOpen(true)}
                  >
                    {isBannedFromCampaign ? (
                      <Prohibit className="size-4" weight="bold" />
                    ) : (
                      <CurrencyDollar className="size-4" weight="bold" />
                    )}
                    {isBannedFromCampaign
                      ? "You're banned"
                      : campaign.status === "paused"
                        ? "Campaign paused"
                        : campaign.status === "completed"
                          ? "Campaign ended"
                          : budgetRemaining <= 0
                            ? "Budget exhausted"
                            : sourceMissing
                              ? "Source unavailable"
                              : "Submit my clip"}
                  </Button>
                  <p className="mt-3 text-center text-[11px] text-muted-foreground">
                    {isBannedFromCampaign
                      ? "The creator banned you from participating in this campaign."
                      : campaign.status === "paused"
                        ? "This campaign is temporarily paused by the creator."
                        : campaign.status === "completed"
                          ? "This campaign has ended."
                          : budgetRemaining <= 0
                            ? "This campaign has no available budget right now."
                            : sourceMissing
                              ? "The source video is no longer available. Ask the creator for a new link."
                              : "48h creator review or auto-approve"}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {isOwner && campaign.isPrivate && shareUrl && (
            <Card className="border-primary/30 bg-primary/5 backdrop-blur">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <Lock className="size-4 text-primary" weight="fill" />
                  <p className="text-sm font-medium">Private campaign link</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this with clippers you want to invite. Only people with
                  the link can view and submit.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="h-8 font-mono text-[11px]"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(shareUrl)
                        setLinkCopied(true)
                        toast.success("Link copied")
                      } catch {
                        toast.error("Failed to copy")
                      }
                    }}
                  >
                    {linkCopied ? (
                      <Check className="size-3.5" weight="bold" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {payoutTiers.length > 0 && (
            <Card className="border-border/60 bg-card/70 p-4 backdrop-blur">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Payout example
              </p>
              <p className="mb-3 text-[11px] text-muted-foreground">
                Based on {formatCurrency(budgetRemaining)} remaining
                {campaign.maxPayoutPerClip
                  ? ` · ${formatCurrency(campaign.maxPayoutPerClip)} max per clip`
                  : ""}
              </p>
              <div className="space-y-2 text-sm">
                {payoutTiers.map((t) => (
                  <div key={t.views} className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {formatCompactNumber(t.views)} views
                      {t.isMax && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-primary">
                          max
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        t.isMax && "text-primary"
                      )}
                    >
                      {formatCurrency(t.payout)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Submit Dialog */}
      <Dialog
        open={submitOpen}
        onOpenChange={(open) => {
          if (!submitting) setSubmitOpen(open)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit your clip</DialogTitle>
            <DialogDescription>
              Paste the URL of your published clip on one of the allowed platforms.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="post-url">Post URL</Label>
              <Input
                id="post-url"
                placeholder="https://www.tiktok.com/@you/video/…"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                aria-invalid={!!urlError}
              />
              {urlError ? (
                <p className="text-xs text-destructive">{urlError}</p>
              ) : detectedPlatform ? (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <PlatformIcon platform={detectedPlatform} className="size-3" />
                  Detected {platformLabels[detectedPlatform]}
                </p>
              ) : null}
            </div>

            <Separator />

            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox
                checked={acked}
                onCheckedChange={(v) => setAcked(Boolean(v))}
                className="mt-0.5"
              />
              <span>
                I have read and agree to follow all campaign requirements.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              disabled={submitting}
              onClick={() => setSubmitOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={!formValid}
              loading={submitting}
              onClick={handleSubmit}
            >
              Submit clip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function StatMini({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[11px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function ClipStatusBadge({ status, isBanned }: { status: string; isBanned?: boolean }) {
  if (isBanned) {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-destructive/40 bg-destructive/10 text-destructive"
      >
        <Prohibit className="size-3" weight="bold" />
        Banned
      </Badge>
    )
  }
  const config: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    pending: {
      label: "Pending review",
      className: "border-warning/40 bg-warning/10 text-warning",
      icon: <Clock className="size-3" weight="fill" />,
    },
    approved: {
      label: "Approved",
      className: "border-success/40 bg-success/10 text-success",
      icon: <CheckCircle className="size-3" weight="fill" />,
    },
    auto_approved: {
      label: "Auto-approved",
      className: "border-success/40 bg-success/10 text-success",
      icon: <CheckCircle className="size-3" weight="fill" />,
    },
    paid: {
      label: "Paid",
      className: "border-primary/40 bg-primary/10 text-primary",
      icon: <CurrencyDollar className="size-3" weight="fill" />,
    },
    rejected: {
      label: "Rejected",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
      icon: <XCircle className="size-3" weight="fill" />,
    },
  }
  const s = config[status] ?? config.pending
  return (
    <Badge variant="outline" className={`gap-1.5 ${s.className}`}>
      {s.icon}
      {s.label}
    </Badge>
  )
}

