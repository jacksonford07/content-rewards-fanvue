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
  FilmSlate,
  WarningCircle,
  CurrencyDollar,
  CreditCard,
  Wallet,
  Sparkle,
  Info,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { RichTextEditor, getTextLength } from "@/components/rich-text-editor"
import { PlatformIcon } from "@/components/platform-icon"
import { formatCurrency, myCampaigns, platformLabels } from "@/lib/mock-data"
import type { Platform, RequirementsType } from "@/lib/types"
import { cn } from "@/lib/utils"

const allSteps = [
  { id: 1, label: "Basics", description: "Title & description" },
  { id: 2, label: "Requirements", description: "Brief for clippers" },
  { id: 3, label: "Source", description: "Google Drive video" },
  { id: 4, label: "Platforms", description: "Where clips can post" },
  { id: 5, label: "Rewards", description: "Rate & budget" },
  { id: 6, label: "Fund", description: "Escrow payment" },
]

export function CreateCampaignPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editing = Boolean(id)
  const existing = editing ? myCampaigns.find((c) => c.id === id) : undefined

  const [step, setStep] = useState(1)
  const stepRefs = useRef<(HTMLLIElement | null)[]>([])
  const [state, setState] = useState(() => ({
    title: existing?.title ?? "",
    description: existing?.description ?? "",
    requirementsType: (existing?.requirementsType ?? "native") as RequirementsType,
    requirementsText: existing?.requirementsText ?? "",
    requirementsUrl: existing?.requirementsUrl ?? "",
    sourceUrl: existing?.sourceContentUrl ?? "",
    platforms: (existing?.allowedPlatforms ?? []) as Platform[],
    rewardRate: existing ? existing.rewardRatePer1k.toString() : "3.00",
    totalBudget: existing ? existing.totalBudget.toString() : "1000",
    minThreshold: existing ? existing.minPayoutThreshold.toString() : "2000",
    maxPerClip: existing?.maxPayoutPerClip
      ? existing.maxPayoutPerClip.toString()
      : "",
    paymentMethod: "wallet" as "wallet" | "card",
  }))

  // Scroll active step into view
  useEffect(() => {
    stepRefs.current[step - 1]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    })
  }, [step])

  // In edit mode we skip the "Fund" step — budget is already in escrow.
  const steps = editing ? allSteps.slice(0, 5) : allSteps

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
        parseFloat(state.minThreshold) >= 500
      )
    return true
  }, [step, state])

  const budgetNum = parseFloat(state.totalBudget || "0")
  const rateNum = parseFloat(state.rewardRate || "0")
  const clipsAffordable = rateNum
    ? Math.floor(budgetNum / (parseFloat(state.maxPerClip || "50") || 50))
    : 0

  const handlePublish = () => {
    if (editing) {
      toast.success("Campaign updated", {
        description: `${state.title} changes are saved.`,
      })
    } else {
      toast.success("Campaign created and funded", {
        description: `${state.title} is now live in the hub.`,
      })
    }
    navigate("/creator/campaigns")
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
        <Button variant="ghost" size="sm" asChild>
          <Link to="/creator/campaigns">
            <ArrowLeft className="size-4" />
            Back
          </Link>
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
            const done = s.id < step
            const current = s.id === step
            return (
              <li key={s.id} ref={(el) => { stepRefs.current[i] = el }} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border px-3 py-2 transition-colors min-w-[136px]",
                    done && "border-success/40 bg-success/5",
                    current && "border-primary/50 bg-primary/10",
                    !done && !current && "border-border/60 bg-card/60"
                  )}
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
          {step === 1 && (
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

          {step === 2 && (
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

          {step === 3 && (
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

          {step === 4 && (
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

          {step === 5 && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Reward rate (USD per 1,000 views)</Label>
                  <div className="relative">
                    <CurrencyDollar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="number"
                      className="pl-9 tabular-nums"
                      value={state.rewardRate}
                      onChange={(e) => update("rewardRate", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Total budget</Label>
                  <div className="relative">
                    <CurrencyDollar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="number"
                      className="pl-9 tabular-nums"
                      value={state.totalBudget}
                      onChange={(e) => update("totalBudget", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Min views before submittable</Label>
                  <Input
                    type="number"
                    className="tabular-nums"
                    value={state.minThreshold}
                    onChange={(e) => update("minThreshold", e.target.value)}
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
                      type="number"
                      className="pl-9 tabular-nums"
                      placeholder="Unlimited"
                      value={state.maxPerClip}
                      onChange={(e) => update("maxPerClip", e.target.value)}
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

          {step === 6 && (
            <div className="space-y-5">
              <p className="text-sm font-medium">
                Fund your escrow — your campaign goes live once payment clears.
              </p>

              <RadioGroup
                value={state.paymentMethod}
                onValueChange={(v) =>
                  update("paymentMethod", v as "wallet" | "card")
                }
                className="grid gap-3"
              >
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors",
                    state.paymentMethod === "wallet"
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/70 bg-background/50"
                  )}
                >
                  <RadioGroupItem value="wallet" className="shrink-0" />
                  <Wallet className="size-5 text-primary" weight="fill" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Fanvue wallet balance</p>
                    <p className="text-xs text-muted-foreground">
                      Available balance: {formatCurrency(1248.65)}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-success/40 bg-success/10 text-success">
                    Instant
                  </Badge>
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors",
                    state.paymentMethod === "card"
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/70 bg-background/50"
                  )}
                >
                  <RadioGroupItem value="card" className="shrink-0" />
                  <CreditCard className="size-5 text-primary" weight="fill" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Card (Stripe)</p>
                    <p className="text-xs text-muted-foreground">
                      Charge automatically from a saved card
                    </p>
                  </div>
                </label>
              </RadioGroup>

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
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          disabled={step === 1}
          onClick={() => setStep((s) => s - 1)}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {step < steps.length ? (
          <Button
            disabled={!canNext}
            onClick={() => setStep((s) => s + 1)}
          >
            Next step
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button disabled={!canNext} onClick={handlePublish}>
            {editing ? (
              <>
                <Check weight="bold" className="size-4" />
                Save changes
              </>
            ) : (
              <>
                <Sparkle weight="fill" className="size-4" />
                Fund & publish
              </>
            )}
          </Button>
        )}
      </div>
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

type ThumbState = "idle" | "loading" | "success" | "error"

function ThumbnailPreview({ url }: { url: string }) {
  const [state, setState] = useState<ThumbState>("idle")
  const prevUrl = useRef("")

  // Mock: when a valid-looking URL is entered, simulate fetching thumbnail
  useEffect(() => {
    if (url === prevUrl.current) return
    prevUrl.current = url

    if (!url.trim().startsWith("http")) {
      setState("idle")
      return
    }

    setState("loading")
    const timer = setTimeout(() => {
      // Mock: treat Google Drive URLs as success, others as error
      if (url.includes("drive.google.com")) {
        setState("success")
      } else {
        setState("error")
      }
    }, 1500)

    return () => clearTimeout(timer)
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
      <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
          <FilmSlate className="size-6 text-primary/60" weight="fill" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="flex size-6 items-center justify-center rounded-full bg-white/90">
            <div className="ml-0.5 size-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-foreground" />
          </div>
        </div>
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
