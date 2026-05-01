import { useEffect, useMemo, useState } from "react"
import { CheckCircle, Wallet, ChatCircle } from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/page-header"
import {
  PAYOUT_METHODS,
  CONTACT_CHANNELS,
  payoutMethodLabel,
  validatePayoutMethod,
  validateContact,
  type PayoutMethod,
  type ContactChannel,
} from "@/lib/payout-validators"
import {
  usePayoutSettings,
  useUpdatePayoutSettings,
} from "@/queries/payout-methods"
import { analytics } from "@/lib/analytics"

const METHOD_PLACEHOLDER: Record<PayoutMethod, string> = {
  paypal: "you@example.com or @handle",
  wise: "you@example.com",
  usdc_eth: "0x… (ERC-20 address)",
  usdc_sol: "Solana wallet address",
  eth: "0x… (Ethereum wallet)",
  sol: "Solana wallet address",
  btc: "bc1… (segwit) or 1…/3… (legacy)",
  bank_uk: "12-34-56 12345678",
  bank_us: "021000021 000123456789",
  bank_iban: "GB29 NWBK 6016 1331 9268 19",
  cashapp: "$cashtag",
  venmo: "@handle",
}

const METHOD_HELP: Record<PayoutMethod, string> = {
  paypal: "Email or @handle the creator can send to.",
  wise: "Email tied to your Wise account.",
  usdc_eth: "Receives USDC on Ethereum mainnet (ERC-20).",
  usdc_sol: "Receives USDC on Solana (SPL).",
  eth: "Receives native ETH.",
  sol: "Receives native SOL.",
  btc: "Receives native BTC. Copy the address — never type it by hand.",
  bank_uk: "Sort code + 8-digit account number.",
  bank_us: "9-digit ABA routing + account number, separated by space.",
  bank_iban: "Single-string IBAN; spaces ignored.",
  cashapp: "Cashtag (with $).",
  venmo: "Venmo handle (with @).",
}

const CONTACT_PLACEHOLDER: Record<ContactChannel, string> = {
  telegram: "@yourhandle",
  whatsapp: "+447700900123",
  phone: "+447700900123",
  email: "you@example.com",
}

interface MethodRow {
  method: PayoutMethod
  enabled: boolean
  value: string
  // Latest validation error for this row, if any. Re-computed on edit.
  error: string | null
  // Mark dirty so we know which rows to send on save.
  dirty: boolean
}

export function PayoutSettingsPage() {
  const { data, isLoading } = usePayoutSettings()
  const update = useUpdatePayoutSettings()

  const [rows, setRows] = useState<MethodRow[]>(() =>
    PAYOUT_METHODS.map((method) => ({
      method,
      enabled: false,
      value: "",
      error: null,
      dirty: false,
    })),
  )

  const [contactChannel, setContactChannel] = useState<ContactChannel | "">("")
  const [contactValue, setContactValue] = useState("")
  const [contactError, setContactError] = useState<string | null>(null)

  // Hydrate from server data on first load.
  useEffect(() => {
    if (!data) return
    setRows((prev) =>
      prev.map((r) => {
        const saved = data.methods.find((m) => m.method === r.method)
        return saved
          ? { ...r, enabled: true, value: saved.value, dirty: false, error: null }
          : { ...r, enabled: false, value: "", dirty: false, error: null }
      }),
    )
    setContactChannel(data.contactChannel ?? "")
    setContactValue(data.contactValue ?? "")
  }, [data])

  const enabledRows = rows.filter((r) => r.enabled)
  const formError = useMemo(() => {
    if (enabledRows.length === 0) {
      return "Enable at least one payout method"
    }
    const rowErr = enabledRows.find((r) => r.error || !r.value.trim())
    if (rowErr) return `Fix the highlighted method`
    if (!contactChannel) return "Pick a contact channel"
    if (contactError || !contactValue.trim()) return "Fix the contact field"
    return null
  }, [enabledRows, contactChannel, contactError, contactValue])

  const handleToggle = (method: PayoutMethod, enabled: boolean) => {
    setRows((prev) =>
      prev.map((r) =>
        r.method === method
          ? { ...r, enabled, dirty: true, error: enabled ? r.error : null }
          : r,
      ),
    )
  }

  const handleValueChange = (method: PayoutMethod, value: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.method !== method) return r
        const result = value.trim()
          ? validatePayoutMethod(method, value)
          : { valid: true as const }
        return {
          ...r,
          value,
          dirty: true,
          error: result.valid ? null : result.error,
        }
      }),
    )
  }

  const handleContactValueChange = (value: string) => {
    setContactValue(value)
    if (!contactChannel || !value.trim()) {
      setContactError(null)
      return
    }
    const result = validateContact(contactChannel, value)
    setContactError(result.valid ? null : result.error)
  }

  const handleContactChannelChange = (channel: ContactChannel) => {
    setContactChannel(channel)
    if (!contactValue.trim()) {
      setContactError(null)
      return
    }
    const result = validateContact(channel, contactValue)
    setContactError(result.valid ? null : result.error)
  }

  const handleSave = async () => {
    if (formError) {
      toast.error(formError)
      return
    }
    const methods = enabledRows.map((r) => ({
      method: r.method,
      value: r.value.trim(),
    }))
    try {
      await update.mutateAsync({
        methods,
        contactChannel: contactChannel as ContactChannel,
        contactValue: contactValue.trim(),
      })
      analytics.payoutSettingsSaved({
        methods_count: methods.length,
        has_contact: !!contactValue.trim(),
      })
      toast.success("Payout settings saved")
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : undefined
      toast.error(msg ?? "Couldn't save payout settings")
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-8">
        <Skeleton className="mb-6 h-8 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Payout settings"
        description="Tell creators how to pay you. Payouts happen off-platform — pick the methods you actually accept and the channel you want to be reached on."
        className="mb-6"
      />

      <Card className="mb-6 border-border/60 bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="size-4 text-primary" weight="fill" />
            Accepted methods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.map((r) => (
            <div
              key={r.method}
              className="rounded-lg border border-border/60 bg-background/50 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {payoutMethodLabel(r.method)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {METHOD_HELP[r.method]}
                  </p>
                </div>
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(v) => handleToggle(r.method, v)}
                  aria-label={`Enable ${payoutMethodLabel(r.method)}`}
                />
              </div>
              {r.enabled && (
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor={`v-${r.method}`} className="text-xs">
                    {payoutMethodLabel(r.method)} value
                  </Label>
                  <Input
                    id={`v-${r.method}`}
                    placeholder={METHOD_PLACEHOLDER[r.method]}
                    value={r.value}
                    onChange={(e) =>
                      handleValueChange(r.method, e.target.value)
                    }
                    aria-invalid={!!r.error || undefined}
                    className={r.error ? "border-destructive" : ""}
                  />
                  {r.error && (
                    <p className="text-xs text-destructive">{r.error}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-6 border-border/60 bg-card/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ChatCircle className="size-4 text-primary" weight="fill" />
            How creators can reach you
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Channel</Label>
              <Select
                value={contactChannel}
                onValueChange={(v) =>
                  handleContactChannelChange(v as ContactChannel)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a channel" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_CHANNELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Value</Label>
              <Input
                placeholder={
                  contactChannel
                    ? CONTACT_PLACEHOLDER[contactChannel]
                    : "Pick a channel first"
                }
                value={contactValue}
                onChange={(e) => handleContactValueChange(e.target.value)}
                disabled={!contactChannel}
                aria-invalid={!!contactError || undefined}
                className={contactError ? "border-destructive" : ""}
              />
              {contactError && (
                <p className="text-xs text-destructive">{contactError}</p>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Creators see this when they mark a submission paid, so they can
            confirm the payout details with you out-of-band.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {formError ? formError : "All set — save to update your profile."}
        </p>
        <Button
          disabled={!!formError || update.isPending}
          loading={update.isPending}
          onClick={handleSave}
        >
          <CheckCircle weight="fill" className="size-4" />
          Save settings
        </Button>
      </div>
    </div>
  )
}
