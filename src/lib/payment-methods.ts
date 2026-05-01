/**
 * Off-platform payment methods. Source-of-truth list shared between the
 * clipper profile (what they accept), campaign creation (what creators pay
 * in), and the mark-paid flow (what the creator used).
 */

export type PaymentMethodType =
  | "paypal"
  | "wise"
  | "usdc_eth"
  | "usdc_sol"
  | "btc"
  | "bank_uk"
  | "bank_us"
  | "cashapp"
  | "venmo"

export type ContactMethod = "telegram" | "whatsapp" | "phone" | "email"

export interface ClipperPaymentMethod {
  type: PaymentMethodType
  value: string
  note?: string
}

export const PAYMENT_METHODS: Array<{
  type: PaymentMethodType
  label: string
  /** Field hint shown next to the value input. */
  valueLabel: string
  /** Region scope, surfaced to creators picking which methods they support. */
  scope: "global" | "us" | "uk"
}> = [
  { type: "paypal", label: "PayPal", valueLabel: "Email", scope: "global" },
  { type: "wise", label: "Wise", valueLabel: "Email or @wisetag", scope: "global" },
  { type: "usdc_eth", label: "USDC (Ethereum)", valueLabel: "0x address", scope: "global" },
  { type: "usdc_sol", label: "USDC (Solana)", valueLabel: "Sol address", scope: "global" },
  { type: "btc", label: "Bitcoin", valueLabel: "BTC address", scope: "global" },
  { type: "bank_uk", label: "Bank — UK", valueLabel: "Sort code + account", scope: "uk" },
  { type: "bank_us", label: "Bank — US", valueLabel: "Routing + account", scope: "us" },
  { type: "cashapp", label: "Cash App", valueLabel: "$cashtag", scope: "us" },
  { type: "venmo", label: "Venmo", valueLabel: "@username", scope: "us" },
]

export const CONTACT_METHODS: Array<{
  type: ContactMethod
  label: string
  hint: string
}> = [
  { type: "telegram", label: "Telegram", hint: "@username" },
  { type: "whatsapp", label: "WhatsApp", hint: "+44 7… number" },
  { type: "phone", label: "Phone", hint: "+44 7… number" },
  { type: "email", label: "Email", hint: "you@example.com" },
]

const labelByType: Record<PaymentMethodType, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.type, m.label]),
) as Record<PaymentMethodType, string>

export function paymentMethodLabel(type: PaymentMethodType | string): string {
  return labelByType[type as PaymentMethodType] ?? type
}

export function contactMethodLabel(type: ContactMethod | string | null | undefined): string {
  if (!type) return ""
  const found = CONTACT_METHODS.find((c) => c.type === type)
  return found?.label ?? type
}
