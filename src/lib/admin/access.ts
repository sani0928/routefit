import { getSessionUser } from "@/lib/member/api";

function allowedAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

type AdminCandidate = { email?: string | null; emailVerified?: boolean | null };

export function isAdminUser(user: AdminCandidate | null | undefined) {
  if (!user?.email || !user.emailVerified) return false;
  return allowedAdminEmails().has(user.email.trim().toLowerCase());
}

export async function getAdminUser() {
  const user = await getSessionUser();
  return isAdminUser(user) ? user : null;
}
