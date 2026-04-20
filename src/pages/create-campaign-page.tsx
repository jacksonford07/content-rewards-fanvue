import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, Link, useParams } from "react-router-dom"
import {
  Check,
  ArrowLeft,
  ArrowRight,
  TextB,
  LinkSimple,
  CloudArrowUp,
  CircleNotch,
  CheckCircle,
  WarningCircle,
  CurrencyDollar,
  Wallet,
  Sparkle,
  Info,
  ArrowCircleUp,
  FloppyDisk,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { RichTextEditor, getTextLength } from "@/components/rich-text-editor"
import { PlatformIcon } from "@/components/platform-icon"
import { formatCurrency, platformLabels } from "@/lib/mock-data"
import api from "@/lib/api"
import {
  useCreateCampaign,
  useFundCampaign,
  useUpdateCampaign,
} from "@/queries/campaigns"
import { useTopup } from "@/queries/wallet"
import { NotFoundCard } from "@/components/not-found-card"
import { useAuth } from "@/hooks/use-auth"
import type { Campaign, Platform, RequirementsType } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const allSteps = [
  { id: 1, label: "Basics", description: "Title & description" },
  { id: 2, label: "Requirements", description: "Brief for clippers" },
  { id: 3, label: "Source", description: "Google Drive video" },
  { id: 4, label: "Platforms", description: "Where clips can post" },
  { id: 5, label: "Rewards", description: "Rate & budget" },
  { id: 6, label: "Fund", description: "Escrow payment" },
]

function getFirstIncompleteStep(c: Campaign): number {
  if (!c.title || c.title === "Untitled draft") return 1
  if (!c.description) return 1
  const hasReqs = c.requirementsType === "native"
    ? (c.requirementsText ?? "").length > 10
    : (c.requirementsUrl ?? "").startsWith("http")
  if (!hasReqs) return 2
  if (!c.sourceContentUrl?.startsWith("http")) return 3
  if (!c.allowedPlatforms?.length) return 4
  if (!c.rewardRatePer1k || c.rewardRatePer1k <= 0) return 5
  return 6
}

export function CreateCampaignPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editing = Boolean(id)
  const { user, refresh } = useAuth()
  const createMutation = useCreateCampaign()
  const updateMutation = useUpdateCampaign()
  const fundMutation = useFundCampaign()
  const topupMutation = useTopup()
  const [, setExisting] = useState<Campaign | undefined>()
  const [loadError, setLoadError] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(Boolean(id))
  const [topupOpen, setTopupOpen] = useState(false)
  const [topupAmount, setTopupAmount] = useState("")
  const [draftId, setDraftId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [initialSnapshot, setInitialSnapshot] = useState("")

  const [step, setStep] = useState(1)
  const [maxStep, setMaxStep] = useState(1)
  const stepRefs = useRef<(HTMLLIElement | null)[]>([])
  const [state, setState] = useState(() => ({
    title: "",
    description: "",
    requirementsType: "native" as RequirementsType,
    requirementsText: "",
    requirementsUrl: "",
    sourceUrl: "",
    platforms: [] as Platform[],
    rewardRate: "3.00",
    totalBudget: "1000",
    minThreshold: "2000",
    maxPerClip: "",
  }))

  useEffect(() => {
    if (!id) {
      setInitialSnapshot(JSON.stringify(state))
      return
    }
    setLoadingExisting(true)
    setLoadError(false)
    api.get(`/campaigns/${id}`).then((res) => {
      const c: Campaign = res.data
      setExisting(c)
      const loaded = {
        title: c.title,
        description: c.description,
        requirementsType: c.requirementsType,
        requirementsText: c.requirementsText ?? "",
        requirementsUrl: c.requirementsUrl ?? "",
        sourceUrl: c.sourceContentUrl,
        platforms: c.allowedPlatforms,
        rewardRate: c.rewardRatePer1k.toString(),
        totalBudget: c.totalBudget.toString(),
        minThreshold: c.minPayoutThreshold.toString(),
        maxPerClip: c.maxPayoutPerClip ? c.maxPayoutPerClip.toString() : "",
      }
      setState(loaded)
      setInitialSnapshot(JSON.stringify(loaded))
      // Published campaigns cannot be edited — redirect
      if (c.status !== "draft" && c.status !== "pending_budget") {
        navigate("/creator/campaigns", { replace: true })
        return
      }
      const nextStep = getFirstIncompleteStep(c)
      setStep(nextStep)
      setMaxStep(nextStep)
    }).catch(() => setLoadError(true)).finally(() => setLoadingExisting(false))
  }, [id])

  // Track highest step reached
  useEffect(() => {
    setMaxStep((prev) => Math.max(prev, step))
  }, [step])

  // Scroll active step into view
  useEffect(() => {
    stepRefs.current[step - 1]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    })
  }, [step])

  const hasChanges = initialSnapshot !== "" && JSON.stringify(state) !== initialSnapshot

  const handleBack = () => {
    if (hasChanges) {
      setLeaveOpen(true)
    } else {
      navigate("/creator/campaigns")
    }
  }

  const steps = allSteps

  const update = <K extends keyof typeof state>(
    key: K,
    value: (typeof state)[K]
  ) => setState((s) => ({ ...s, [key]: value }))

  const togglePlatform = (p: Platform) => {
    setState((s) => ({
      ...s,
      platforms: s.platforms.includes(p)
        ? s.platforms.filter((x) => x !== p)
        : [...s.platforms, p],
    }))
  }

  const budgetNum = parseFloat(state.totalBudget || "0")
  const rateNum = parseFloat(state.rewardRate || "0")
  const minViewsNum = parseFloat(state.minThreshold || "0")
  const maxPerClipNum = parseFloat(state.maxPerClip || "0")
  const clipsAffordable = rateNum
    ? Math.floor(budgetNum / (parseFloat(state.maxPerClip || "50") || 50))
    : 0

  // Single-clip payout at exactly min views (capped by maxPerClip if set)
  const payoutAtMin = rateNum > 0 ? (minViewsNum / 1000) * rateNum : 0
  const cappedPayoutAtMin = maxPerClipNum > 0 ? Math.min(payoutAtMin, maxPerClipNum) : payoutAtMin
  const minThresholdExceedsBudget =
    budgetNum > 0 && rateNum > 0 && minViewsNum > 0 && cappedPayoutAtMin > budgetNum
  const maxAllowedMinViews =
    budgetNum > 0 && rateNum > 0 ? Math.floor((budgetNum / rateNum) * 1000) : 0

  const canNext = useMemo(() => {
    if (step === 1) return state.title.trim() && state.description.trim()
    if (step === 2)
      return state.requirementsType === "native"
        ? getTextLength(state.requirementsText) > 10
        : state.requirementsUrl.trim().startsWith("http")
    if (step === 3) return state.sourceUrl.trim().startsWith("http")
    if (step === 4) return state.platforms.length > 0
    if (step === 5)
      return (
        parseFloat(state.rewardRate) > 0 &&
        parseFloat(state.totalBudget) >= 100 &&
        parseFloat(state.minThreshold) >= 0
      )
    return true
  }, [step, state])

  const [showMinThresholdError, setShowMinThresholdError] = useState(false)
  useEffect(() => {
    if (!minThresholdExceedsBudget) setShowMinThresholdError(false)
  }, [minThresholdExceedsBudget])

  const validateRewards = (): boolean => {
    if (minThresholdExceedsBudget) {
      setShowMinThresholdError(true)
      if (step !== 5) setStep(5)
      toast.error("Min views too high for this budget", {
        description: `At ${formatCurrency(rateNum)}/1K views, a single clip would pay ${formatCurrency(
          cappedPayoutAtMin,
        )} — more than the ${formatCurrency(budgetNum)} budget. Max allowed: ${maxAllowedMinViews.toLocaleString()} views.`,
      })
      return false
    }
    return true
  }

  const buildPayload = () => {
    const fileId = extractGDriveFileId(state.sourceUrl)
    const thumbUrl = fileId
      ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`
      : null
    return {
      title: state.title,
      description: state.description,
      requirementsType: state.requirementsType,
      requirementsText: state.requirementsText,
      requirementsUrl: state.requirementsUrl,
      sourceContentUrl: state.sourceUrl,
      sourceThumbnailUrl: thumbUrl,
      allowedPlatforms: state.platforms,
      rewardRatePer1k: parseFloat(state.rewardRate) || 0,
      totalBudget: parseFloat(state.totalBudget) || 0,
      minPayoutThreshold: parseFloat(state.minThreshold) || 0,
      maxPayoutPerClip: state.maxPerClip ? parseFloat(state.maxPerClip) : undefined,
    }
  }

  const saveCampaign = async (status: "draft" | "pending_budget") => {
    const payload = { ...buildPayload(), status }
    const cid = draftId || id
    if (cid) {
      await updateMutation.mutateAsync({ id: cid, body: payload })
      return cid
    }
    const data = await createMutation.mutateAsync(payload)
    setDraftId(data.id)
    return data.id as string
  }

  const handleSaveDraft = async () => {
    if (!validateRewards()) return
    setSaving(true)
    try {
      await saveCampaign("draft")
      toast.success("Draft saved")
    } catch {
      toast.error("Failed to save draft")
    }
    setSaving(false)
  }

  const handleSaveAsPending = async () => {
    if (!validateRewards()) return
    setSaving(true)
    try {
      await saveCampaign("pending_budget")
      toast.success("Campaign saved", {
        description: "Fund it any time from the budget page.",
      })
      navigate("/creator/campaigns")
    } catch {
      toast.error("Failed to save campaign")
    }
    setSaving(false)
  }

  const handlePublish = async () => {
    if (!validateRewards()) return
    setSaving(true)
    try {
      const cid = await saveCampaign("pending_budget")
      await fundMutation.mutateAsync({
        id: cid,
        amount: parseFloat(state.totalBudget),
      })
      await refresh()
      toast.success("Campaign created and funded", {
        description: `${state.title} is now live in the hub.`,
      })
      navigate("/creator/campaigns")
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || ""
      if (msg.includes("Insufficient wallet balance")) {
        toast.error("Insufficient wallet balance", {
          description: "Top up your wallet before funding a campaign.",
        })
      } else {
        toast.error("Failed to create campaign")
      }
    }
    setSaving(false)
  }

  if (loadError) {
    return (
      <NotFoundCard
        title="Campaign not found"
        description="This draft may have been deleted, or the link is outdated."
        backTo="/creator/campaigns"
        backLabel="Back to campaigns"
      />
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6 md:py-8">
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
              <BreadcrumbPage>
                {editing ? "Edit campaign" : "New campaign"}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {editing ? "Edit clipping campaign" : "Create clipping campaign"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {editing
            ? "Update your brief, source, rewards, or platforms. Escrowed budget stays in place."
            : "Fund a budget, upload source material, and let clippers spread your content."}
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-6 overflow-x-auto no-scrollbar">
        <ol className="flex min-w-max items-center gap-2">
          {steps.map((s, i) => {
            const done = s.id <= maxStep && s.id !== step
            const current = s.id === step
            return (
              <li key={s.id} ref={(el) => { stepRefs.current[i] = el }} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border px-3 py-2 transition-colors min-w-[136px]",
                    done && "border-success/40 bg-success/5 cursor-pointer hover:bg-success/10",
                    current && "border-primary/50 bg-primary/10",
                    !done && !current && "border-border/60 bg-card/60"
                  )}
                  onClick={() => { if (s.id <= maxStep) setStep(s.id) }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                        done && "bg-success text-success-foreground",
                        current && "bg-primary text-primary-foreground",
                        !done && !current && "bg-muted text-muted-foreground"
                      )}
                    >
                      {done ? <Check className="size-3" weight="bold" /> : s.id}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        current ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {s.description}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <ArrowRight
                    className="size-3 shrink-0 text-muted-foreground"
                    weight="bold"
                  />
                )}
              </li>
            )
          })}
        </ol>
      </div>

      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardContent className="p-6">
          {loadingExisting ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          ) : null}

          {!loadingExisting && step === 1 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Campaign title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Summer Beach Vibes — Lifestyle Clips"
                  value={state.title}
                  onChange={(e) => update("title", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This is the public-facing name clippers will see on the hub.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Short description</Label>
                <Textarea
                  id="description"
                  rows={3}
                  placeholder="One or two sentences that appear on the campaign card."
                  value={state.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </div>
            </div>
          )}

          {!loadingExisting && step === 2 && (
            <div className="space-y-5">
              <RadioGroup
                value={state.requirementsType}
                onValueChange={(v) =>
                  update("requirementsType", v as RequirementsType)
                }
                className="grid gap-3 md:grid-cols-2"
              >
                <RequirementOption
                  value="native"
                  selected={state.requirementsType === "native"}
                  icon={<TextB className="size-5" />}
                  title="Write in app"
                  description="Rich text editor with headings, lists, bold & underline."
                />
                <RequirementOption
                  value="google_doc"
                  selected={state.requirementsType === "google_doc"}
                  icon={<LinkSimple className="size-5" />}
                  title="Link a Google Doc"
                  description="Keep the brief external and clutter-free."
                />
              </RadioGroup>

              {state.requirementsType === "native" ? (
                <div className="space-y-2">
                  <Label>Brief</Label>
                  <RichTextEditor
                    content={state.requirementsText}
                    onChange={(html) => update("requirementsText", html)}
                    placeholder="Write your requirements here… (format, length, tone, hashtags, hooks, do's & don'ts)"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="docUrl">Google Doc URL</Label>
                  <Input
                    id="docUrl"
                    placeholder="https://docs.google.com/document/d/…"
                    value={state.requirementsUrl}
                    onChange={(e) => update("requirementsUrl", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Make sure the doc is public or set to "Anyone with the
                    link".
                  </p>
                </div>
              )}
            </div>
          )}

          {!loadingExisting && step === 3 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="sourceUrl">Google Drive video URL</Label>
                <Input
                  id="sourceUrl"
                  placeholder="https://drive.google.com/file/d/…/view"
                  value={state.sourceUrl}
                  onChange={(e) => update("sourceUrl", e.target.value)}
                />
              </div>
              <Alert className="border-primary/30 bg-primary/5">
                <Info className="size-4 text-primary" />
                <AlertTitle>Trusted as-is</AlertTitle>
                <AlertDescription>
                  In v1 we trust your link without automated validation. Make
                  sure clippers can access the file — set sharing to "Anyone
                  with the link".
                </AlertDescription>
              </Alert>
              <ThumbnailPreview url={state.sourceUrl} />
            </div>
          )}

          {!loadingExisting && step === 4 && (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                Select all platforms where clippers can post
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(["tiktok", "instagram", "youtube"] as Platform[]).map((p) => {
                  const selected = state.platforms.includes(p)
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
                        selected
                          ? "border-primary/60 bg-primary/10"
                          : "border-border/70 bg-background/50 hover:border-border"
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <PlatformIcon platform={p} className="size-5" />
                        {selected && (
                          <Check
                            weight="bold"
                            className="size-4 text-primary"
                          />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {platformLabels[p]}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Short-form vertical video
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {!loadingExisting && step === 5 && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Reward rate (USD per 1,000 views)</Label>
                  <div className="relative">
                    <CurrencyDollar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="pl-9 tabular-nums"
                      value={state.rewardRate}
                      onChange={(e) => { let v = e.target.value.replace(/[^0-9.]/g, "").replace(/^0+(\d)/, "$1"); if ((v.match(/\./g) || []).length <= 1) update("rewardRate", v) }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Total budget (min $100)</Label>
                  <div className="relative">
                    <CurrencyDollar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="pl-9 tabular-nums"
                      value={state.totalBudget}
                      onChange={(e) => { let v = e.target.value.replace(/[^0-9.]/g, "").replace(/^0+(\d)/, "$1"); if ((v.match(/\./g) || []).length <= 1) update("totalBudget", v) }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Min views before submittable</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    aria-invalid={showMinThresholdError || undefined}
                    className={cn(
                      "tabular-nums",
                      showMinThresholdError && "border-destructive focus-visible:ring-destructive/40"
                    )}
                    value={state.minThreshold}
                    onChange={(e) => update("minThreshold", e.target.value.replace(/[^0-9]/g, "").replace(/^0+(\d)/, "$1"))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Clippers can't submit clips with fewer views
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Max payout per clip (optional)</Label>
                  <div className="relative">
                    <CurrencyDollar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      inputMode="decimal"
                      className="pl-9 tabular-nums"
                      placeholder="Unlimited"
                      value={state.maxPerClip}
                      onChange={(e) => { let v = e.target.value.replace(/[^0-9.]/g, "").replace(/^0+(\d)/, "$1"); if ((v.match(/\./g) || []).length <= 1) update("maxPerClip", v) }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Cap spend on a single viral clip
                  </p>
                </div>
              </div>

              <Alert className="border-primary/30 bg-primary/5">
                <Sparkle className="size-4 text-primary" weight="fill" />
                <AlertTitle>Spend preview</AlertTitle>
                <AlertDescription className="space-y-1">
                  <span className="block">
                    At{" "}
                    <strong className="text-foreground">
                      {formatCurrency(rateNum)} per 1K views
                    </strong>
                    , {formatCurrency(budgetNum)} covers approximately{" "}
                    <strong className="text-foreground">
                      {Math.floor((budgetNum / rateNum) * 1000).toLocaleString()}{" "}
                      verified views
                    </strong>
                    .
                  </span>
                  {state.maxPerClip && (
                    <span className="block">
                      With a {formatCurrency(parseFloat(state.maxPerClip))}/clip
                      cap, you could pay out up to{" "}
                      <strong className="text-foreground">
                        {clipsAffordable} max-cap clips
                      </strong>
                      .
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {!loadingExisting && step === 6 && (
            <div className="space-y-5">
              <p className="text-sm font-medium">
                Fund your escrow — your campaign goes live once payment clears.
              </p>

              <div className={cn(
                "flex items-center gap-3 rounded-xl border p-4",
                (user?.walletBalance ?? 0) >= budgetNum
                  ? "border-primary/60 bg-primary/10"
                  : "border-warning/60 bg-warning/10"
              )}>
                <Wallet className="size-5 text-primary" weight="fill" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Fanvue wallet balance</p>
                  <p className="text-xs text-muted-foreground">
                    Available balance: {formatCurrency(user?.walletBalance ?? 0)}
                  </p>
                </div>
                {(user?.walletBalance ?? 0) >= budgetNum ? (
                  <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                    Instant
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => { setTopupAmount(""); setTopupOpen(true) }}>
                    <ArrowCircleUp className="size-4" weight="fill" />
                    Top up
                  </Button>
                )}
              </div>

              {(user?.walletBalance ?? 0) < budgetNum && (
                <Alert className="border-warning/30 bg-warning/5">
                  <WarningCircle className="size-4 text-warning" weight="fill" />
                  <AlertTitle>Insufficient balance</AlertTitle>
                  <AlertDescription>
                    You need {formatCurrency(budgetNum - (user?.walletBalance ?? 0))} more to fund this campaign. Top up your wallet to continue.
                  </AlertDescription>
                </Alert>
              )}

              <Card className="border-border/60 bg-background/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Summary
                </p>
                <Separator className="my-3" />
                <div className="space-y-2 text-sm">
                  <Row
                    label="Campaign title"
                    value={state.title || "Untitled"}
                  />
                  <Row
                    label="Reward rate"
                    value={`${formatCurrency(rateNum)} / 1K views`}
                  />
                  <Row
                    label="Platforms"
                    value={
                      state.platforms.length
                        ? state.platforms
                            .map((p) => platformLabels[p])
                            .join(", ")
                        : "None selected"
                    }
                  />
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between text-base font-semibold">
                    <span>Total to fund</span>
                    <span className="tabular-nums text-primary">
                      {formatCurrency(budgetNum)}
                    </span>
                  </div>
                </div>
              </Card>

              <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <Checkbox defaultChecked className="mt-0.5" />
                <span>
                  I understand budget is held in escrow, released at day-30 view
                  lock. Unused budget can be withdrawn or rolled into a new
                  campaign.
                </span>
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nav */}
      {!loadingExisting && (
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          disabled={step === 1}
          onClick={() => setStep((s) => s - 1)}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        <div className="flex items-center gap-2">
          {step < steps.length ? (
            <>
              <Button
                variant="outline"
                loading={saving}
                onClick={step >= 5 ? handleSaveAsPending : handleSaveDraft}
              >
                <FloppyDisk className="size-4" />
                Save draft
              </Button>
              <Button
                disabled={!canNext}
                onClick={() => {
                  if (step === 5 && !validateRewards()) return
                  setStep((s) => s + 1)
                }}
              >
                Next step
                <ArrowRight className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                loading={saving}
                onClick={handleSaveAsPending}
              >
                <FloppyDisk className="size-4" />
                Save draft
              </Button>
              {(() => {
                const insufficientBalance = (user?.walletBalance ?? 0) < budgetNum
                const btn = (
                  <Button
                    disabled={!canNext || insufficientBalance}
                    loading={saving}
                    onClick={handlePublish}
                  >
                    <Sparkle weight="fill" className="size-4" />
                    Fund & publish
                  </Button>
                )
                if (insufficientBalance) {
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>{btn}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Top up your wallet to fund this campaign
                      </TooltipContent>
                    </Tooltip>
                  )
                }
                return btn
              })()}
            </>
          )}
        </div>
      </div>
      )}

      {/* Inline top-up dialog */}
      <Dialog
        open={topupOpen}
        onOpenChange={(open) => {
          if (!topupMutation.isPending) setTopupOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Top up wallet</DialogTitle>
            <DialogDescription>
              Add funds to your Fanvue wallet to fund this campaign.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {[100, 500, 1000, 5000].map((n) => (
                <Button
                  key={n}
                  variant="outline"
                  onClick={() => setTopupAmount(n.toString())}
                >
                  ${n}
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="topup-amount-inline">Custom amount</Label>
              <Input
                id="topup-amount-inline"
                type="number"
                placeholder="0.00"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={topupMutation.isPending}
              onClick={() => setTopupOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  await topupMutation.mutateAsync(parseFloat(topupAmount) || 0)
                  toast.success("Wallet topped up", {
                    description: `${formatCurrency(parseFloat(topupAmount) || 0)} added to your balance.`,
                  })
                  await refresh()
                  setTopupOpen(false)
                  setTopupAmount("")
                } catch {
                  toast.error("Top-up failed")
                }
              }}
              disabled={!topupAmount || parseFloat(topupAmount) <= 0}
              loading={topupMutation.isPending}
            >
              Confirm payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={leaveOpen}
        onOpenChange={(o) => {
          if (!saving) setLeaveOpen(o)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Would you like to save them as a draft before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="outline"
              disabled={saving}
              onClick={() => navigate("/creator/campaigns")}
            >
              Discard & leave
            </AlertDialogAction>
            <Button
              loading={saving}
              onClick={async () => {
                await handleSaveDraft()
                navigate("/creator/campaigns")
              }}
            >
              Save draft & leave
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RequirementOption({
  value,
  selected,
  icon,
  title,
  description,
}: {
  value: string
  selected: boolean
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
        selected
          ? "border-primary/60 bg-primary/10"
          : "border-border/70 bg-background/50 hover:border-border"
      )}
    >
      <RadioGroupItem value={value} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-2 text-primary">{icon}</div>
        <p className="mt-1 text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </label>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate max-w-[60%] text-right font-medium">
        {value}
      </span>
    </div>
  )
}

function extractGDriveFileId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  return match?.[1] ?? null
}

type ThumbState = "idle" | "loading" | "success" | "error"

function ThumbnailPreview({ url }: { url: string }) {
  const [state, setState] = useState<ThumbState>("idle")
  const [thumbUrl, setThumbUrl] = useState("")
  const prevUrl = useRef("")

  useEffect(() => {
    if (url === prevUrl.current) return
    prevUrl.current = url

    const fileId = extractGDriveFileId(url)
    if (!fileId) {
      setState(url.trim().startsWith("http") ? "error" : "idle")
      setThumbUrl("")
      return
    }

    setState("loading")
    const imgUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`
    const img = new Image()
    img.onload = () => {
      setThumbUrl(imgUrl)
      setState("success")
    }
    img.onerror = () => setState("error")
    img.src = imgUrl
  }, [url])

  if (state === "idle") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/70 bg-background/40 p-5">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <CloudArrowUp className="size-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Preview thumbnail</p>
          <p className="text-xs text-muted-foreground">
            Enter a Google Drive URL above and we'll pull a thumbnail automatically.
          </p>
        </div>
      </div>
    )
  }

  if (state === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/40 p-5">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
          <CircleNotch className="size-5 text-primary animate-spin" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Checking video link…</p>
          <p className="text-xs text-muted-foreground">
            Verifying access and pulling thumbnail.
          </p>
        </div>
      </div>
    )
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
          <WarningCircle className="size-5 text-destructive" weight="fill" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Couldn't pull thumbnail</p>
          <p className="text-xs text-muted-foreground">
            Make sure the link is a Google Drive video with "Anyone with the link" access.
          </p>
        </div>
      </div>
    )
  }

  // success
  return (
    <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-5">
      <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        <img src={thumbUrl} alt="Video thumbnail" className="size-full object-cover" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="size-4 text-success" weight="fill" />
          <p className="text-sm font-medium">Thumbnail pulled</p>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Video is accessible. Clippers will see this preview.
        </p>
      </div>
    </div>
  )
}
