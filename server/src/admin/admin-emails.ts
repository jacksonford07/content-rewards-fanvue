// Shared admin-email allowlist. Read by both AdminService.assertAdmin
// (gates /admin/* endpoints) and AuthService.me (surfaces isAdmin to
// the client so the sidebar can render the Admin section).
//
// Override via the ADMIN_EMAILS env var (comma-separated). Defaults
// include the dev-admin@test.local Dev Login fixture so local testing
// works out of the box.

const DEFAULT_ADMIN_EMAILS =
  "jackson.ford@fanvue.com,iniaki.boudiaf@fanvue.com,dev-admin@test.local";

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? DEFAULT_ADMIN_EMAILS;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}
