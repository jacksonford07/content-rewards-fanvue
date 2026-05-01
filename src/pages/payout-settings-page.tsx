import { useEffect, useMemo, useState } from "react"
import { Plus, Trash, Info } from "@phosphor-icons/react"
import { toast } from "sonner"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/use-auth"
import { useUpdateMe } from "@/queries/auth"
import {
  CONTACT_METHODS,
  PAYMENT_METHODS,
  type ClipperPaymentMethod,
  type ContactMethod,
  type PaymentMethodType,
} from "@/lib/payment-methods"

export function PayoutSettingsPage() {
  const { user, refresh } = useAuth()
  const updateMe = useUpdateMe()

  const [contactMethod, setContactMethod] = useState<ContactMethod | "">("")
  const [contactHandle, setContactHandle] = useState("")
  const [methods, setMethods] = useState<ClipperPaymentMethod[]>([])
  const [draft, setDraft] = useState<{
    type: PaymentMethodType | ""
    value: string
    note: string
  }>({ type: "", value: "", note: "" })

  // Hydrate state when user data lands.
  useEffect(() => {
    if (!user) return
    setContactMethod((user.contactMethod ?? "") as ContactMethod | "")
    setContactHandle(user.contactHandle ?? "")
    setMethods(user.paymentMethods ?? [])
  }, [user?.id])

  const dirty = useMemo(() => {
    if (!user) return false
    if ((user.contactMethod ?? "") !== contactMethod) return true
    if ((user.contactHandle ?? "") !== contactHandle) return true
    if (
      JSON.stringify(user.paymentMethods ?? []) !== JSON.stringify(methods)
    )
      return true
    return false
  }, [user, contactMethod, contactHandle, methods])

  const addMethod = () => {
    if (!draft.type || !draft.value.trim()) return
    if (methods.find((m) => m.type === draft.type)) {
      toast.error("Already added", {
        description: "Edit the existing entry below or remove it first.",
      })
      return
    }
    setMethods((cur) => [
      ...cur,
      {
        type: draft.type as PaymentMethodType,
        value: draft.value.trim(),
        ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
      },
    ])
    setDraft({ type: "", value: "", note: "" })
  }

  const removeMethod = (type: PaymentMethodType) => {
    setMethods((cur) => cur.filter((m) => m.type !== type))
  }

  const updateMethodValue = (type: PaymentMethodType, value: string) => {
    setMethods((cur) =>
      cur.map((m) => (m.type === type ? { ...m, value } : m)),
    )
  }

  const handleSave = async () => {
    if (contactMethod && !contactHandle.trim()) {
      toast.error("Contact handle is required when a method is set")
      return
    }
    try {
      await updateMe.mutateAsync({
        contactMethod: contactMethod || null,
        contactHandle: contactHandle.trim() || null,
        paymentMethods: methods,
      })
      await refresh()
      toast.success("Payout details saved")
    } catch {
      toast.error("Couldn't save changes")
    }
  }

  const draftValueLabel =
    PAYMENT_METHODS.find((m) => m.type === draft.type)?.valueLabel ?? "Value"

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Payout details"
        description="Creators pay clippers off-platform. Tell creators how to reach you and how you accept payment so payouts go through smoothly."
      />

      <Alert className="mt-6 border-primary/30 bg-primary/5">
        <Info className="size-4 text-primary" />
        <AlertTitle>Visible only after a creator approves your clip</AlertTitle>
        <AlertDescription>
          We never show your payment details on public pages. Creators only see
          this once they've approved a submission of yours.
        </AlertDescription>
      </Alert>

      {/* Contact */}
      <Card className="mt-6 border-border/60 bg-card/70">
        <CardContent className="p-6">
          <h2 className="text-base font-semibold">Best way to reach you</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Creators message you here when they're about to send a payout.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[200px_1fr]">
            <div className="space-y-1.5">
              <Label>Method</Label>
              <Select
                value={contactMethod}
                onValueChange={(v) => setContactMethod(v as ContactMethod)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_METHODS.map((c) => (
                    <SelectItem key={c.type} value={c.type}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Handle</Label>
              <Input
                placeholder={
                  CONTACT_METHODS.find((c) => c.type === contactMethod)?.hint ??
                  "@username or +44…"
                }
                value={contactHandle}
                onChange={(e) => setContactHandle(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment methods */}
      <Card className="mt-6 border-border/60 bg-card/70">
        <CardContent className="p-6">
          <h2 className="text-base font-semibold">Payment methods you accept</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add every option you're comfortable receiving. The more you accept,
            the more campaigns you can take part in.
          </p>

          {methods.length > 0 && (
            <ul className="mt-4 space-y-2">
              {methods.map((m) => {
                const meta = PAYMENT_METHODS.find((p) => p.type === m.type)
                return (
                  <li
                    key={m.type}
                    className="grid gap-2 rounded-xl border border-border/60 bg-background/40 p-3 sm:grid-cols-[160px_1fr_auto] sm:items-center"
                  >
                    <span className="text-sm font-medium">{meta?.label}</span>
                    <Input
                      value={m.value}
                      onChange={(e) =>
                        updateMethodValue(m.type, e.target.value)
                      }
                      placeholder={meta?.valueLabel}
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMethod(m.type)}
                      aria-label="Remove"
                    >
                      <Trash className="size-4" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}

          <Separator className="my-5" />

          <div className="space-y-3">
            <p className="text-sm font-medium">Add a method</p>
            <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto]">
              <Select
                value={draft.type}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, type: v as PaymentMethodType }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Type…" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.filter(
                    (m) => !methods.some((existing) => existing.type === m.type),
                  ).map((m) => (
                    <SelectItem key={m.type} value={m.type}>
                      {m.label}
                      {m.scope !== "global" && (
                        <span className="ml-2 text-[10px] uppercase text-muted-foreground">
                          {m.scope}
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={draft.value}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, value: e.target.value }))
                }
                placeholder={draftValueLabel}
                disabled={!draft.type}
              />
              <Button
                variant="outline"
                onClick={addMethod}
                disabled={!draft.type || !draft.value.trim()}
              >
                <Plus className="size-4" weight="bold" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button
          onClick={handleSave}
          disabled={!dirty || updateMe.isPending}
          loading={updateMe.isPending}
        >
          Save changes
        </Button>
      </div>
    </div>
  )
}
