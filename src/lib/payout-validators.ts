// Per-method payout validators.
//
// Shape validation + IBAN mod-97 checksum. No external library deps —
// we deliberately avoid pulling viem / @solana/web3.js / bitcoinjs-lib
// / iban for v1 (~600KB hit for what is fundamentally "is this string
// roughly the right shape").
//
// **IMPORTANT**: For ETH / Solana / BTC we only validate shape (charset
// + length). EIP-55 / bech32 / base58 checksums are NOT verified here.
// A 1-character typo will pass this validator and might result in lost
// funds. The intended defence-in-depth is Tier B blockchain
// verification (M2.6 spike): once a creator marks a crypto payout
// paid, we look up the tx on-chain and only credit the trust score
// when the recipient address matches the saved value byte-for-byte.
// Until M2.6 lands, the recommendation in the UI is to copy-paste
// addresses, never type by hand.

export const PAYOUT_METHODS = [
  "paypal",
  "wise",
  "usdc_eth",
  "usdc_sol",
  "eth",
  "sol",
  "btc",
  "bank_uk",
  "bank_us",
  "bank_iban",
  "cashapp",
  "venmo",
] as const

export type PayoutMethod = (typeof PAYOUT_METHODS)[number]

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string }

const OK: ValidationResult = { valid: true }
const fail = (error: string): ValidationResult => ({ valid: false, error })

const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  paypal: "PayPal",
  wise: "Wise",
  usdc_eth: "USDC (Ethereum)",
  usdc_sol: "USDC (Solana)",
  eth: "Ethereum (ETH)",
  sol: "Solana (SOL)",
  btc: "Bitcoin (BTC)",
  bank_uk: "UK bank",
  bank_us: "US bank",
  bank_iban: "IBAN",
  cashapp: "Cash App",
  venmo: "Venmo",
}

export function payoutMethodLabel(method: PayoutMethod): string {
  return PAYOUT_METHOD_LABELS[method]
}

export function validatePayoutMethod(
  method: PayoutMethod,
  value: string,
): ValidationResult {
  const v = value.trim()
  if (!v) return fail("Required")
  switch (method) {
    case "paypal":
    case "cashapp":
    case "venmo":
      return validateEmailOrHandle(v)
    case "wise":
      return validateEmail(v)
    case "eth":
    case "usdc_eth":
      return validateEthAddress(v)
    case "sol":
    case "usdc_sol":
      return validateSolAddress(v)
    case "btc":
      return validateBtcAddress(v)
    case "bank_uk":
      return validateUkBank(v)
    case "bank_us":
      return validateUsBank(v)
    case "bank_iban":
      return validateIban(v)
  }
}

// ─── Contact channel ────────────────────────────────────────────────────────

export const CONTACT_CHANNELS = [
  "telegram",
  "whatsapp",
  "phone",
  "email",
] as const
export type ContactChannel = (typeof CONTACT_CHANNELS)[number]

export function validateContact(
  channel: ContactChannel,
  value: string,
): ValidationResult {
  const v = value.trim()
  if (!v) return fail("Required")
  switch (channel) {
    case "email":
      return validateEmail(v)
    case "phone":
    case "whatsapp":
      return validateE164(v)
    case "telegram":
      return validateTelegramHandle(v)
  }
}

// ─── Implementations ────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail(v: string): ValidationResult {
  return EMAIL_RE.test(v) ? OK : fail("Enter a valid email")
}

function validateEmailOrHandle(v: string): ValidationResult {
  if (EMAIL_RE.test(v)) return OK
  // Handle: @handle or handle. Allow letters, numbers, dot, underscore,
  // hyphen. 3–32 chars. Cash App style ($cashtag) allowed via leading $.
  if (/^[$@]?[a-zA-Z0-9._-]{3,32}$/.test(v)) return OK
  return fail("Enter an email or @handle")
}

// E.164: optional +, 8–15 digits, no spaces.
function validateE164(v: string): ValidationResult {
  const stripped = v.replace(/\s+/g, "")
  if (!/^\+?[1-9]\d{7,14}$/.test(stripped)) {
    return fail("Use international format, e.g. +447700900123")
  }
  return OK
}

function validateTelegramHandle(v: string): ValidationResult {
  // Telegram: @ optional, 5-32 chars, [a-zA-Z0-9_], must start with letter.
  if (!/^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(v)) {
    return fail("Telegram handle: 5–32 characters, letters/digits/_")
  }
  return OK
}

// Ethereum: 0x + 40 hex chars. No checksum verification (see header).
function validateEthAddress(v: string): ValidationResult {
  if (!/^0x[a-fA-F0-9]{40}$/.test(v)) {
    return fail("Ethereum address: 0x + 40 hex characters")
  }
  return OK
}

// Solana: base58, length 32–44 chars (32-byte addresses encode to ~43–44).
const BASE58_CHARSET = /^[1-9A-HJ-NP-Za-km-z]+$/
function validateSolAddress(v: string): ValidationResult {
  if (v.length < 32 || v.length > 44) {
    return fail("Solana address: 32–44 base58 characters")
  }
  if (!BASE58_CHARSET.test(v)) {
    return fail("Solana address must be base58 (no 0/O/I/l)")
  }
  return OK
}

// Bitcoin: accept legacy P2PKH (1...), P2SH (3...), and bech32 (bc1...).
// Shape only; no bech32 checksum.
function validateBtcAddress(v: string): ValidationResult {
  // bech32 (segwit): bc1[a-z0-9]{8,87} (lower-case)
  if (/^bc1[a-z0-9]{8,87}$/.test(v)) return OK
  // legacy P2PKH (1) / P2SH (3): base58, 25–34 chars.
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(v)) return OK
  return fail("Bitcoin address: bc1… (segwit) or 1…/3… (legacy)")
}

// UK bank: sort code NN-NN-NN (or NNNNNN) + 8-digit account number.
function validateUkBank(v: string): ValidationResult {
  // Accept formats: "12-34-56 12345678", "123456 12345678", "123456/12345678"
  const stripped = v.replace(/[\s\-/]/g, "")
  if (!/^\d{14}$/.test(stripped)) {
    return fail("Use sort code + 8-digit account number")
  }
  return OK
}

// US bank: 9-digit ABA routing number + account number (4–17 digits).
function validateUsBank(v: string): ValidationResult {
  const parts = v.split(/[\s/]+/).filter(Boolean)
  if (parts.length < 2) return fail("Routing number and account number")
  const routing = (parts[0] ?? "").replace(/\D/g, "")
  const account = (parts[1] ?? "").replace(/\D/g, "")
  if (routing.length !== 9) return fail("Routing number must be 9 digits")
  if (account.length < 4 || account.length > 17) {
    return fail("Account number must be 4–17 digits")
  }
  return OK
}

// IBAN: country (2 letters) + check digits (2) + BBAN (up to 30 alphanumeric).
// We do the proper mod-97 checksum here.
function validateIban(v: string): ValidationResult {
  const stripped = v.replace(/\s+/g, "").toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(stripped)) {
    return fail("Looks like an invalid IBAN format")
  }
  // Move the first 4 chars to the end, convert letters to numbers
  // (A=10, B=11, …), then mod 97 must equal 1.
  const rearranged = stripped.slice(4) + stripped.slice(0, 4)
  let numeric = ""
  for (const ch of rearranged) {
    if (ch >= "0" && ch <= "9") numeric += ch
    else numeric += String(ch.charCodeAt(0) - "A".charCodeAt(0) + 10)
  }
  // Compute mod 97 in chunks (number is too big for JS's Number).
  let remainder = 0
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = remainder.toString() + numeric.slice(i, i + 7)
    remainder = parseInt(chunk, 10) % 97
  }
  return remainder === 1 ? OK : fail("IBAN checksum failed")
}
