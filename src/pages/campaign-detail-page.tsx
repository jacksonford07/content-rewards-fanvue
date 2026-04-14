import { Link, useParams, useNavigate } from "react-router-dom"
import { useEffect, useMemo, useState } from "react"
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
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { PlatformIcon } from "@/components/platform-icon"
import {
  campaigns,
  formatCompactNumber,
  formatCurrency,
  platformLabels,
} from "@/lib/mock-data"
import type { Platform } from "@/lib/types"

export function CampaignDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [submitOpen, setSubmitOpen] = useState(false)
  const [postUrl, setPostUrl] = useState("")
  const [platform, setPlatform] = useState<Platform | "">("")
  const [acked, setAcked] = useState(false)

  const campaign = campaigns.find((c) => c.id === id) ?? campaigns[0]
  const budgetRemaining = campaign.totalBudget - campaign.budgetSpent
  const budgetPct = Math.round(
    (campaign.budgetSpent / campaign.totalBudget) * 100
  )

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
    if (detectedPlatform && campaign.allowedPlatforms.includes(detectedPlatform)) {
      setPlatform(detectedPlatform)
    }
  }, [detectedPlatform, campaign.allowedPlatforms])

  // URL validation: must be a valid URL and match allowed platforms
  const urlError: string | null = useMemo(() => {
    if (!postUrl.trim()) return null
    try {
      new URL(postUrl)
    } catch {
      return "Paste a valid URL"
    }
    if (!detectedPlatform) return "URL must be from TikTok, Instagram, or YouTube"
    if (!campaign.allowedPlatforms.includes(detectedPlatform))
      return `${platformLabels[detectedPlatform]} isn't allowed for this campaign`
    return null
  }, [postUrl, detectedPlatform, campaign.allowedPlatforms])

  const formValid = postUrl.trim() && platform && acked && !urlError

  const handleSubmit = () => {
    setSubmitOpen(false)
    setPostUrl("")
    setPlatform("")
    setAcked(false)
    toast.success("Submission received", {
      description:
        "We're running AI pre-screening now. You'll hear back within 48 hours.",
    })
    navigate("/submissions")
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex items-center justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Hub</Link>
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
          <Link to="/">
            <ArrowLeft className="size-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main content */}
        <div className="min-w-0 space-y-6">
          {/* Hero video card */}
          <Card className="overflow-hidden border-border/60 bg-card/70 p-0 backdrop-blur">
            <div className="relative aspect-video w-full overflow-hidden">
              <img
                src={campaign.sourceThumbnailUrl}
                alt={campaign.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <button
                className="absolute inset-0 flex items-center justify-center"
                aria-label="Play preview"
              >
                <span className="flex size-16 items-center justify-center rounded-full bg-background/90 shadow-2xl backdrop-blur transition-transform hover:scale-110">
                  <PlayCircle
                    weight="fill"
                    className="size-10 text-primary"
                  />
                </span>
              </button>
              <div className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-success/40 bg-success/10 text-success"
                >
                  <Lightning weight="fill" className="size-3" />
                  Live
                </Badge>
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-semibold text-white sm:text-2xl md:text-3xl">
                    {campaign.title}
                  </h1>
                  <p className="mt-1 line-clamp-1 text-sm text-white/80">
                    {campaign.description}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Creator card */}
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardContent className="flex items-center gap-4 p-4 md:p-6">
              <Avatar className="size-12 ring-2 ring-primary/20">
                <AvatarImage src={campaign.creator.avatarUrl} />
                <AvatarFallback>
                  {campaign.creator.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-semibold">
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
              <Button variant="outline" size="sm">
                View profile
              </Button>
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
                <div className="rounded-lg border border-border/60 bg-background/50 p-4">
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                    {campaign.requirementsText}
                  </p>
                </div>
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

          {/* Source content */}
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CloudArrowDown className="size-4 text-primary" />
                Source content
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background/50 p-4 sm:flex-row sm:items-center">
                <img
                  src={campaign.sourceThumbnailUrl}
                  alt="Source thumbnail"
                  className="h-20 w-32 shrink-0 rounded-lg object-cover"
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
              <Alert className="mt-4 border-warning/30 bg-warning/10 text-warning-foreground">
                <Info className="size-4" />
                <AlertTitle>Heads up</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                  Don't reupload source files or share credentials. Use this
                  material only to produce short-form clips within this
                  campaign's rules.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
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
                  label="Budget remaining"
                  value={formatCurrency(budgetRemaining)}
                />
                <Progress value={budgetPct} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  {budgetPct}% of {formatCurrency(campaign.totalBudget)} spent
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

              <Button
                className="mt-6 w-full"
                size="lg"
                onClick={() => setSubmitOpen(true)}
              >
                <CurrencyDollar className="size-4" weight="bold" />
                Submit my clip
              </Button>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                AI pre-screening + 48h creator review
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 p-4 backdrop-blur">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Payout example
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">10,000 views</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(10 * campaign.rewardRatePer1k)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">50,000 views</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(50 * campaign.rewardRatePer1k)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">100,000 views</span>
                <span className="font-semibold tabular-nums text-primary">
                  {formatCurrency(100 * campaign.rewardRatePer1k)}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Submit Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit your clip</DialogTitle>
            <DialogDescription>
              Paste your posted clip URL. Make sure your clip has at least{" "}
              {formatCompactNumber(campaign.minPayoutThreshold)} views before
              submitting.
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
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={platform}
                onValueChange={(v) => setPlatform(v as Platform)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose platform" />
                </SelectTrigger>
                <SelectContent>
                  {campaign.allowedPlatforms.map((p) => (
                    <SelectItem key={p} value={p}>
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={p} />
                        {platformLabels[p]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <Checkbox
                checked={acked}
                onCheckedChange={(v) => setAcked(Boolean(v))}
                className="mt-0.5"
              />
              <span>
                I confirm my clip meets all campaign requirements and has at
                least {formatCompactNumber(campaign.minPayoutThreshold)} views.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!formValid} onClick={handleSubmit}>
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

