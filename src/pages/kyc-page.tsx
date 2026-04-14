import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  IdentificationCard,
  Bank,
  ClipboardText,
  CloudArrowUp,
  CircleNotch,
  CheckCircle,
  ShieldCheck,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { cn } from "@/lib/utils"

const steps = [
  { id: 1, label: "Personal", description: "Name & address" },
  { id: 2, label: "Identity", description: "Government ID" },
  { id: 3, label: "Bank", description: "Payout account" },
  { id: 4, label: "Review", description: "Submit for approval" },
]

export function KycPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const stepRefs = useRef<(HTMLLIElement | null)[]>([])

  const [state, setState] = useState({
    fullName: "",
    dateOfBirth: "",
    country: "",
    address: "",
    city: "",
    postalCode: "",
    idFront: null as File | null,
    idBack: null as File | null,
    idFrontName: "",
    idBackName: "",
    idProcessing: false,
    idVerified: false,
    bankName: "",
    accountHolder: "",
    routingNumber: "",
    accountNumber: "",
  })

  useEffect(() => {
    stepRefs.current[step - 1]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    })
  }, [step])

  const update = <K extends keyof typeof state>(
    key: K,
    value: (typeof state)[K]
  ) => setState((s) => ({ ...s, [key]: value }))

  const simulateIdUpload = (side: "front" | "back", name: string) => {
    if (side === "front") {
      update("idFrontName", name)
    } else {
      update("idBackName", name)
    }
  }

  const handleIdVerify = () => {
    update("idProcessing", true)
    setTimeout(() => {
      setState((s) => ({ ...s, idProcessing: false, idVerified: true }))
    }, 2000)
  }

  const canNext = useMemo(() => {
    if (step === 1)
      return (
        state.fullName.trim() &&
        state.dateOfBirth.trim() &&
        state.country &&
        state.address.trim() &&
        state.city.trim() &&
        state.postalCode.trim()
      )
    if (step === 2) return state.idVerified
    if (step === 3)
      return (
        state.bankName.trim() &&
        state.accountHolder.trim() &&
        state.routingNumber.trim().length >= 9 &&
        state.accountNumber.trim().length >= 8
      )
    return true
  }, [step, state])

  const handleSubmit = () => {
    toast.success("KYC submitted successfully", {
      description:
        "Your identity verification is being reviewed. You'll be notified once approved.",
    })
    navigate("/wallet")
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex items-center justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/wallet">Wallet</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Payout setup & KYC</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/wallet">
            <ArrowLeft className="size-4" /> Back
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Payout setup & KYC
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify your identity and link a bank account to enable withdrawals.
        </p>
      </div>

      {/* Stepper */}
      <div className="mb-6 overflow-x-auto no-scrollbar">
        <ol className="flex min-w-max items-center gap-2">
          {steps.map((s, i) => {
            const done = s.id < step
            const current = s.id === step
            return (
              <li
                key={s.id}
                ref={(el) => {
                  stepRefs.current[i] = el
                }}
                className="flex items-center gap-2"
              >
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
                      {done ? (
                        <Check className="size-3" weight="bold" />
                      ) : (
                        s.id
                      )}
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
          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-primary">
                <User className="size-5" weight="fill" />
                <h2 className="text-lg font-semibold">Personal information</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full legal name</Label>
                  <Input
                    id="fullName"
                    placeholder="John Michael Doe"
                    value={state.fullName}
                    onChange={(e) => update("fullName", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={state.dateOfBirth}
                    onChange={(e) => update("dateOfBirth", e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Country of residence</Label>
                  <Select
                    value={state.country}
                    onValueChange={(v) => update("country", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us">United States</SelectItem>
                      <SelectItem value="gb">United Kingdom</SelectItem>
                      <SelectItem value="ca">Canada</SelectItem>
                      <SelectItem value="au">Australia</SelectItem>
                      <SelectItem value="de">Germany</SelectItem>
                      <SelectItem value="fr">France</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Street address</Label>
                  <Input
                    id="address"
                    placeholder="123 Main Street, Apt 4B"
                    value={state.address}
                    onChange={(e) => update("address", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="New York"
                    value={state.city}
                    onChange={(e) => update("city", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal / ZIP code</Label>
                  <Input
                    id="postalCode"
                    placeholder="10001"
                    value={state.postalCode}
                    onChange={(e) => update("postalCode", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Identity */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-primary">
                <IdentificationCard className="size-5" weight="fill" />
                <h2 className="text-lg font-semibold">Identity verification</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Upload a photo of your government-issued ID (passport, driver's
                license, or national ID card).
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <UploadBox
                  label="Front of ID"
                  fileName={state.idFrontName}
                  onUpload={(name) => simulateIdUpload("front", name)}
                />
                <UploadBox
                  label="Back of ID"
                  fileName={state.idBackName}
                  onUpload={(name) => simulateIdUpload("back", name)}
                />
              </div>

              {state.idFrontName && state.idBackName && !state.idVerified && (
                <Button
                  onClick={handleIdVerify}
                  disabled={state.idProcessing}
                  className="w-full"
                >
                  {state.idProcessing ? (
                    <>
                      <CircleNotch className="size-4 animate-spin" />
                      Verifying document...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="size-4" weight="fill" />
                      Verify ID
                    </>
                  )}
                </Button>
              )}

              {state.idVerified && (
                <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-4">
                  <CheckCircle
                    className="size-5 text-success"
                    weight="fill"
                  />
                  <div>
                    <p className="text-sm font-medium">
                      Document verified
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Your identity has been confirmed.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Bank Account */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-primary">
                <Bank className="size-5" weight="fill" />
                <h2 className="text-lg font-semibold">Bank account</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Link your bank account for receiving payouts. Withdrawals
                typically arrive in 1-3 business days.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="bankName">Bank name</Label>
                  <Input
                    id="bankName"
                    placeholder="Chase Bank"
                    value={state.bankName}
                    onChange={(e) => update("bankName", e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="accountHolder">Account holder name</Label>
                  <Input
                    id="accountHolder"
                    placeholder="John Michael Doe"
                    value={state.accountHolder}
                    onChange={(e) => update("accountHolder", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="routingNumber">Routing number</Label>
                  <Input
                    id="routingNumber"
                    placeholder="021000021"
                    value={state.routingNumber}
                    onChange={(e) => update("routingNumber", e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    9-digit ABA routing number
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account number</Label>
                  <Input
                    id="accountNumber"
                    placeholder="000123456789"
                    value={state.accountNumber}
                    onChange={(e) => update("accountNumber", e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Your bank account or IBAN number
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-primary">
                <ClipboardText className="size-5" weight="fill" />
                <h2 className="text-lg font-semibold">Review & submit</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Please review your information before submitting.
              </p>

              <Card className="border-border/60 bg-background/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Personal information
                </p>
                <Separator className="my-3" />
                <div className="space-y-2 text-sm">
                  <SummaryRow label="Full name" value={state.fullName} />
                  <SummaryRow label="Date of birth" value={state.dateOfBirth} />
                  <SummaryRow
                    label="Country"
                    value={state.country.toUpperCase()}
                  />
                  <SummaryRow
                    label="Address"
                    value={`${state.address}, ${state.city} ${state.postalCode}`}
                  />
                </div>
              </Card>

              <Card className="border-border/60 bg-background/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Identity verification
                </p>
                <Separator className="my-3" />
                <div className="flex items-center gap-2">
                  <CheckCircle
                    className="size-4 text-success"
                    weight="fill"
                  />
                  <span className="text-sm font-medium">Document verified</span>
                </div>
              </Card>

              <Card className="border-border/60 bg-background/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Bank account
                </p>
                <Separator className="my-3" />
                <div className="space-y-2 text-sm">
                  <SummaryRow label="Bank" value={state.bankName} />
                  <SummaryRow label="Account holder" value={state.accountHolder} />
                  <SummaryRow
                    label="Routing"
                    value={`••••${state.routingNumber.slice(-4)}`}
                  />
                  <SummaryRow
                    label="Account"
                    value={`••••${state.accountNumber.slice(-4)}`}
                  />
                </div>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          disabled={step === 1}
          onClick={() => setStep((s) => s - 1)}
        >
          <ArrowLeft className="size-4" /> Back
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
          <Button onClick={handleSubmit}>
            <ShieldCheck className="size-4" weight="fill" />
            Submit verification
          </Button>
        )}
      </div>
    </div>
  )
}

function UploadBox({
  label,
  fileName,
  onUpload,
}: {
  label: string
  fileName: string
  onUpload: (name: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    if (!fileName) {
      inputRef.current?.click()
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(file.name)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors",
        fileName
          ? "border-success/40 bg-success/5"
          : "border-border/70 bg-background/50 hover:border-border"
      )}
    >
      {fileName ? (
        <>
          <CheckCircle className="size-8 text-success" weight="fill" />
          <p className="text-sm font-medium">Uploaded</p>
          <p className="text-xs text-muted-foreground truncate max-w-full">
            {fileName}
          </p>
        </>
      ) : (
        <>
          <CloudArrowUp className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            Click to upload JPG or PNG
          </p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </button>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate max-w-[60%] text-right font-medium">
        {value}
      </span>
    </div>
  )
}
