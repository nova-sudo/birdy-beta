// What every Whop embedded checkout in the app shares: Settings' checkout
// dialog and setup's plan step.

/** "sandbox" runs Whop's test mode, "production" takes real payments. */
export const WHOP_ENVIRONMENT = (process.env.NEXT_PUBLIC_WHOP_ENVIRONMENT ?? "production") === "sandbox" ? "sandbox" : "production";

/**
 * Best-effort: the signed-in email prefills the form. The account id is the
 * email, which is also how the backend's webhook matches the purchase.
 */
export function storedEmail() {
  try {
    return JSON.parse(localStorage.getItem("user"))?.email ?? "";
  } catch {
    return "";
  }
}
