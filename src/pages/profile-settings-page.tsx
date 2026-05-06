import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  CheckCircle,
  CurrencyDollar,
  Info,
  UserCircle,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import api from "@/lib/api"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/page-header"

// v1.2 M2.5 — creator self-reports their Fanvue page subscription price.
// Convention:
//   null → not set (UI prompts)
//   0    → free page
//   >0   → paid page, monthly cost in cents (USD)
//
// Fanvue's API does not expose this value (only app-store pricing, which
// is something different), so the creator types it in once. Snapshotted
// onto each per-sub campaign at creation time so historical context
// survives later edits to the price.

export function ProfileSettingsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isOnboarding = searchParams.get("onboarding") === "1"
  const { user, refresh } = useAuth()

  const [isFree, setIsFree] = useState(false)
  const [priceDollars, setPriceDollars] = useState("")
  const [saving, setSaving] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from auth user on first load.
  useEffect(() => {
    if (hydrated || !user) return
    const cents = user.fanvuePageSubPriceCents
    if (cents == null) {
      // null = not set yet
      setIsFree(false)
      setPriceDollars("")
    } else if (cents === 0) {
      setIsFree(true)
      setPriceDollars("")
    } else {
      setIsFree(false)
      setPriceDollars((cents / 100).toFixed(2))
    }
    setHydrated(true)
  }, [user, hydrated])

  if (!user) return null
  const isCreator = user.role === "creator" || user.role === "both"

  if (!isCreator) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6 md:py-8">
        <PageHeader
          title="Profile settings"
          description="This page is for creators."
          className="mb-6"
        />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You're signed in as a clipper. Profile-page settings only apply
            to creator accounts.
          </CardContent>
        </Card>
      </div>
    )
  }

  const parsedPrice = parseFloat(priceDollars)
  const validPrice = isFree || (priceDollars.trim() !== "" && !Number.isNaN(parsedPrice) && parsedPrice >= 0)
  const targetCents = isFree ? 0 : Math.round(parsedPrice * 100)
  const currentCents = user.fanvuePageSubPriceCents ?? null
  const isDirty =
    (currentCents == null && (isFree || priceDollars.trim() !== "")) ||
    (currentCents != null && currentCents !== targetCents)

  const handleSave = async () => {
    if (!validPrice) {
      toast.error("Enter a valid monthly price or toggle Free.")
      return
    }
    setSaving(true)
    try {
      await api.patch("/users/me", { fanvuePageSubPriceCents: targetCents })
      await refresh()
      toast.success("Page price saved")
      if (isOnboarding) {
        navigate("/creator/campaigns")
      }
    } catch {
      toast.error("Couldn't save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    navigate("/creator/campaigns")
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title={isOnboarding ? "Tell us about your page" : "Profile settings"}
        description={
          isOnboarding
            ? "One last detail: what do you charge fans for your Fanvue page? Helps clippers reason about subscriber economics on your campaigns."
            : "Settings tied to your creator profile."
        }
        className="mb-6"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle weight="fill" className="size-5 text-primary" />
            Your Fanvue page
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <div className="flex items-start gap-2">
              <Info className="size-4 shrink-0 text-muted-foreground" />
              <span>
                Showing this on your subscriber campaigns helps clippers gauge
                how hard the subs will be to acquire — being upfront tends to
                attract better clippers.
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 p-3">
            <div>
              <Label htmlFor="is-free-toggle" className="text-sm font-medium">
                Free page
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Toggle on if your page is free to subscribe to.
              </p>
            </div>
            <Switch
              id="is-free-toggle"
              checked={isFree}
              onCheckedChange={(v) => {
                setIsFree(v)
                if (v) setPriceDollars("")
              }}
            />
          </div>

          {!isFree && (
            <div className="space-y-2">
              <Label htmlFor="monthly-price">Monthly subscription price (USD)</Label>
              <div className="relative">
                <CurrencyDollar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="monthly-price"
                  type="text"
                  inputMode="decimal"
                  className="pl-9 tabular-nums"
                  placeholder="9.99"
                  value={priceDollars}
                  onChange={(e) => {
                    let v = e.target.value
                      .replace(/[^0-9.]/g, "")
                      .replace(/^0+(\d)/, "$1")
                    if ((v.match(/\./g) || []).length <= 1)
                      setPriceDollars(v)
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                What fans pay per month to subscribe to your Fanvue page.
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            {isOnboarding && (
              <Button variant="ghost" onClick={handleSkip} disabled={saving}>
                Skip for now
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={!validPrice || !isDirty || saving}
            >
              {saving ? (
                "Saving…"
              ) : currentCents != null ? (
                <>
                  <CheckCircle weight="fill" className="size-4" />
                  Save
                </>
              ) : (
                "Save page price"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
