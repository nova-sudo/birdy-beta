// What the app's Whop checkout (whop-checkout.jsx) needs to know, and
// what Whop sends the browser back with.

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

/**
 * How the checkout Whop sent the browser back from went, read off the page's
 * query: Whop lands on the return URL after any payment step off the page,
 * declined and abandoned ones too, and says which in `status`.
 * @param {URLSearchParams} params
 * @returns {"succeeded"|"failed"|"canceled"|"pending"|null} null when Whop said nothing
 */
export function checkoutOutcome(params) {
  const status = params?.get("status");
  if (!status || !(params.get("payment") || params.get("setup"))) return null;
  return ["succeeded", "failed", "canceled"].includes(status) ? status : "pending";
}

/** What Whop adds to the return URL, to drop from the address once read. */
export const WHOP_RETURN_PARAMS = ["payment", "setup", "status"];

/** What to tell the buyer about a checkout that came back unpaid, or null. */
export function checkoutProblem(outcome) {
  if (outcome === "failed") return "The payment didn’t go through, so nothing was charged. Try again or use another card.";
  if (outcome === "canceled") return "The payment was canceled, so nothing was charged.";
  return null;
}
