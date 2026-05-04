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
  Sparkle,
  Info,
  FloppyDisk,
  Lock,
  Copy,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import {
  PAYOUT_METHODS,
  payoutMethodLabel,
  type PayoutMethod,
} from "@/lib/payout-validators"
import api from "@/lib/api"
import {
  useCreateCampaign,
  useUpdateCampaign,
} from "@/queries/campaigns"
import { NotFoundCard } from "@/components/not-found-card"
import { useAuth } from "@/hooks/use-auth"
import type { Campaign, Platform, RequirementsType } from "@/lib/types"
import { cn } from "@/lib/utils"

const allSteps = [
  { id: 1, label: "Basics", description: "Title & description" },
  { id: 2, label: "Requirements", description: "Brief for clippers" },
  { id: 3, label: "Source", description: "Google Drive video" },
  { id: 4, label: "Platforms", description: "Where clips can post" },
  { id: 5, label: "Rewards", description: "Rate, budget & publish" },
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
  return 5
}

export function CreateCampaignPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editing = Boolean(id)
  const { user, refresh } = useAuth()
  const createMutation = useCreateCampaign()
  const updateMutation = useUpdateCampaign()
  const [, setExisting] = useState<Campaign | undefined>()
  const [loadError, setLoadError] = useState(false)
  const [loadingExisting, setLoadingExisting] = useState(Boolean(id))
  const [draftId, setDraftId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savingAction, setSavingAction] = useState<
    null | "draft" | "publish"
  >(null)
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
    ratePerSub: "5.00",
    payoutType: "per_1k_views" as "per_1k_views" | "per_subscriber",
    totalBudget: "1000",
    minThreshold: "2000",
    maxPerClip: "",
    isPrivate: false,
    acceptedPayoutMethods: [] as PayoutMethod[],
  }))
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)

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
        isPrivate: c.isPrivate === true,
        acceptedPayoutMethods: c.acceptedPayoutMethods ?? [],
        payoutType: c.payoutType ?? "per_1k_views",
        ratePerSub: (c.ratePerSub ?? 5).toString(),
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
    if (step === 5) {
      const rateOk =
        state.payoutType === "per_subscriber"
          ? parseFloat(state.ratePerSub) > 0
          : parseFloat(state.rewardRate) > 0
      return (
        rateOk &&
        parseFloat(state.totalBudget) >= 100 &&
        parseFloat(state.minThreshold) >= 0 &&
        state.acceptedPayoutMethods.length > 0
      )
    }
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
      acceptedPayoutMethods: state.acceptedPayoutMethods,
      payoutType: state.payoutType,
      ratePerSub: parseFloat(state.ratePerSub) || 0,
      rewardRatePer1k: parseFloat(state.rewardRate) || 0,
      totalBudget: parseFloat(state.totalBudget) || 0,
      minPayoutThreshold: parseFloat(state.minThreshold) || 0,
      maxPayoutPerClip: state.maxPerClip ? parseFloat(state.maxPerClip) : undefined,
      isPrivate: state.isPrivate,
    }
  }

  const saveCampaign = async (status: "draft" | "active") => {
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
    setSavingAction("draft")
    try {
      await saveCampaign("draft")
      toast.success("Draft saved")
    } catch {
      toast.error("Failed to save draft")
    }
    setSaving(false)
    setSavingAction(null)
  }

  const handlePublish = async () => {
    if (!validateRewards()) return
    // M4.2 — for per-sub campaigns, ensure the creator has granted the
    // write:tracking_links scope. If not, redirect through the OAuth
    // upgrade flow before persisting the campaign.
    if (
      state.payoutType === "per_subscriber" &&
      !user?.fanvueScopes?.includes("write:tracking_links")
    ) {
      const apiUrl = import.meta.env.VITE_API_URL || ""
      // Save a draft first so the campaign isn't lost during the OAuth bounce
      try {
        await saveCampaign("draft")
      } catch {
        // best effort
      }
      toast.message("Granting tracking-link permission…", {
        description:
          "We'll bounce you through Fanvue to grant 'tracking_links' scope, then come back here.",
      })
      window.location.href = `${apiUrl}/api/auth/fanvue?scope=tracking_links`
      return
    }
    setSaving(true)
    setSavingAction("publish")
    try {
      const cid = await saveCampaign("active")
      await refresh()
      if (state.isPrivate) {
        const res = await api.get<Campaign>(`/campaigns/${cid}`)
        if (res.data.privateSlug) {
          setShareLink(`${window.location.origin}/c/${res.data.privateSlug}`)
          setSaving(false)
          setSavingAction(null)
          return
        }
      }
      toast.success("Campaign published", {
        description: `${state.title} is now live in the hub.`,
      })
      navigate("/creator/campaigns")
    } catch {
      toast.error("Failed to publish campaign")
    }
    setSaving(false)
    setSavingAction(null)
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
              {/* M4.1 — payout type toggle */}
              <div className="space-y-2">
                <Label>Payout type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { v: "per_1k_views", label: "Per 1k views" },
                      { v: "per_subscriber", label: "Per subscriber" },
                    ] as const
                  ).map((opt) => {
                    const selected = state.payoutType === opt.v
                    return (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => update("payoutType", opt.v)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                          selected
                            ? "border-primary/60 bg-primary/10 text-primary"
                            : "border-border/70 bg-background/50 hover:border-border",
                        )}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
                {state.payoutType === "per_subscriber" && (
                  <p className="text-[11px] text-muted-foreground">
                    Per-subscriber requires Fanvue tracking-link permission.
                    If you haven't granted it yet you'll be prompted to
                    re-authenticate before publish.
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {state.payoutType === "per_1k_views" ? (
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
                ) : (
                  <div className="space-y-2">
                    <Label>Rate (USD per subscriber)</Label>
                    <div className="relative">
                      <CurrencyDollar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="text"
                        inputMode="decimal"
                        className="pl-9 tabular-nums"
                        value={state.ratePerSub}
                        onChange={(e) => { let v = e.target.value.replace(/[^0-9.]/g, "").replace(/^0+(\d)/, "$1"); if ((v.match(/\./g) || []).length <= 1) update("ratePerSub", v) }}
                      />
                    </div>
                  </div>
                )}
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

              <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={state.isPrivate}
                    onCheckedChange={(v) => update("isPrivate", Boolean(v))}
                    className="mt-0.5 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Lock className="size-4 text-primary" weight="fill" />
                      <span className="text-sm font-medium">
                        Make this campaign private
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Hide from the public hub. You'll get a shareable link to
                      invite specific clippers — only people with the link can
                      view and submit.
                    </p>
                  </div>
                </label>
              </div>

              <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-4">
                <div>
                  <p className="text-sm font-medium">
                    Accepted payout methods
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pick every method you're willing to pay clippers in.
                    Clippers can only submit if at least one of their accepted
                    methods overlaps with yours.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {PAYOUT_METHODS.map((m) => {
                    const selected = state.acceptedPayoutMethods.includes(m)
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            acceptedPayoutMethods: selected
                              ? s.acceptedPayoutMethods.filter((x) => x !== m)
                              : [...s.acceptedPayoutMethods, m],
                          }))
                        }
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
                          selected
                            ? "border-primary/60 bg-primary/10 text-primary"
                            : "border-border/70 bg-background/50 hover:border-border",
                        )}
                      >
                        {selected && <Check weight="bold" className="size-3" />}
                        {payoutMethodLabel(m)}
                      </button>
                    )
                  })}
                </div>
                {state.acceptedPayoutMethods.length === 0 && (
                  <p className="text-xs text-warning">
                    Pick at least one — required to publish.
                  </p>
                )}
              </div>

              <Alert className="border-border/60 bg-background/40">
                <Info className="size-4 text-muted-foreground" />
                <AlertTitle>Off-platform payouts</AlertTitle>
                <AlertDescription>
                  Payouts happen off-platform. After day 30 you'll mark
                  clippers paid here once you've sent them money via PayPal,
                  crypto, bank transfer, etc.
                </AlertDescription>
              </Alert>
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
                loading={savingAction === "draft"}
                disabled={saving && savingAction !== "draft"}
                onClick={handleSaveDraft}
              >
                <FloppyDisk className="size-4" />
                Save draft
              </Button>
              <Button
                disabled={!canNext || saving}
                onClick={() => setStep((s) => s + 1)}
              >
                Next step
                <ArrowRight className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                loading={savingAction === "draft"}
                disabled={saving && savingAction !== "draft"}
                onClick={handleSaveDraft}
              >
                <FloppyDisk className="size-4" />
                Save draft
              </Button>
              <Button
                disabled={!canNext || (saving && savingAction !== "publish")}
                loading={savingAction === "publish"}
                onClick={handlePublish}
              >
                <Sparkle weight="fill" className="size-4" />
                Publish
              </Button>
            </>
          )}
        </div>
      </div>
      )}

      <Dialog
        open={!!shareLink}
        onOpenChange={(open) => {
          if (!open) {
            setShareLink(null)
            setShareCopied(false)
            navigate("/creator/campaigns")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock weight="fill" className="size-5 text-primary" />
              Private campaign created
            </DialogTitle>
            <DialogDescription>
              Share this link with clippers you want to invite. Only people with
              the link can view the campaign and submit clips.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input readOnly value={shareLink ?? ""} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="default"
              onClick={async () => {
                if (!shareLink) return
                try {
                  await navigator.clipboard.writeText(shareLink)
                  setShareCopied(true)
                  toast.success("Link copied to clipboard")
                } catch {
                  toast.error("Failed to copy link")
                }
              }}
            >
              {shareCopied ? (
                <>
                  <Check className="size-4" weight="bold" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setShareLink(null)
                setShareCopied(false)
                navigate("/creator/campaigns")
              }}
            >
              Done
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
    // Drive thumbnails redirect to lh3.googleusercontent.com and behave
    // weirdly when the request carries a Referer (rate-limited or 403'd).
    // Stripping the referer matches what Drive's own UI does.
    img.referrerPolicy = "no-referrer"
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
        <img
          src={thumbUrl}
          alt="Video thumbnail"
          className="size-full object-cover"
          referrerPolicy="no-referrer"
        />
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
