// Server-side mirror of src/lib/payout-validators.ts.
//
// Defence-in-depth: client validates first, server re-validates on POST.
// If you change rules in one place, change them in the other.
//
// See the client-side file for full commentary on why we don't pull
// crypto address libraries.

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
] as const;

export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const CONTACT_CHANNELS = [
  "telegram",
  "whatsapp",
  "phone",
  "email",
] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

const OK: ValidationResult = { valid: true };
const fail = (error: string): ValidationResult => ({ valid: false, error });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validatePayoutMethod(
  method: PayoutMethod,
  value: string,
): ValidationResult {
  const v = value.trim();
  if (!v) return fail("Required");
  switch (method) {
    case "paypal":
    case "cashapp":
    case "venmo":
      return EMAIL_RE.test(v) || /^[$@]?[a-zA-Z0-9._-]{3,32}$/.test(v)
        ? OK
        : fail("Enter an email or @handle");
    case "wise":
      return EMAIL_RE.test(v) ? OK : fail("Enter a valid email");
    case "eth":
    case "usdc_eth":
      return /^0x[a-fA-F0-9]{40}$/.test(v)
        ? OK
        : fail("Ethereum address: 0x + 40 hex characters");
    case "sol":
    case "usdc_sol":
      if (v.length < 32 || v.length > 44) {
        return fail("Solana address: 32–44 base58 characters");
      }
      return /^[1-9A-HJ-NP-Za-km-z]+$/.test(v)
        ? OK
        : fail("Solana address must be base58 (no 0/O/I/l)");
    case "btc":
      if (/^bc1[a-z0-9]{8,87}$/.test(v)) return OK;
      if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(v)) return OK;
      return fail("Bitcoin address: bc1… (segwit) or 1…/3… (legacy)");
    case "bank_uk": {
      const stripped = v.replace(/[\s\-/]/g, "");
      return /^\d{14}$/.test(stripped)
        ? OK
        : fail("Use sort code + 8-digit account number");
    }
    case "bank_us": {
      const parts = v.split(/[\s/]+/).filter(Boolean);
      if (parts.length < 2) return fail("Routing number and account number");
      const routing = (parts[0] ?? "").replace(/\D/g, "");
      const account = (parts[1] ?? "").replace(/\D/g, "");
      if (routing.length !== 9) return fail("Routing number must be 9 digits");
      if (account.length < 4 || account.length > 17)
        return fail("Account number must be 4–17 digits");
      return OK;
    }
    case "bank_iban":
      return validateIban(v);
  }
}

export function validateContact(
  channel: ContactChannel,
  value: string,
): ValidationResult {
  const v = value.trim();
  if (!v) return fail("Required");
  switch (channel) {
    case "email":
      return EMAIL_RE.test(v) ? OK : fail("Enter a valid email");
    case "phone":
    case "whatsapp": {
      const stripped = v.replace(/\s+/g, "");
      return /^\+?[1-9]\d{7,14}$/.test(stripped)
        ? OK
        : fail("Use international format, e.g. +447700900123");
    }
    case "telegram":
      return /^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(v)
        ? OK
        : fail("Telegram handle: 5–32 characters, letters/digits/_");
  }
}

function validateIban(v: string): ValidationResult {
  const stripped = v.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(stripped)) {
    return fail("Looks like an invalid IBAN format");
  }
  const rearranged = stripped.slice(4) + stripped.slice(0, 4);
  let numeric = "";
  for (const ch of rearranged) {
    if (ch >= "0" && ch <= "9") numeric += ch;
    else numeric += String(ch.charCodeAt(0) - "A".charCodeAt(0) + 10);
  }
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    const chunk = remainder.toString() + numeric.slice(i, i + 7);
    remainder = parseInt(chunk, 10) % 97;
  }
  return remainder === 1 ? OK : fail("IBAN checksum failed");
}
