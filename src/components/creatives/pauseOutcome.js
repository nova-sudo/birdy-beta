import { toast } from "@/components/ds"

/**
 * Toasts the result of a pause call (`{paused, errors: [{ad_account_id, message}]}`): success only when
 * nothing failed, a warning naming the failed accounts when some paused, an error when none did.
 * @param {object} res The pause response
 * @param {object} test The test, for its code and its ads' account names
 * @param {string} where Where the pause was aimed, for the success line ("everywhere", an account)
 */
export function reportPause(res, test, where) {
  const errors = Array.isArray(res?.errors) ? res.errors : []
  const paused = Number(res?.paused) || 0
  const nameOf = (act) => (test?.ads ?? []).find((a) => a.ad_account_id === act)?.account_name ?? act
  const failed = errors.map((e) => `${nameOf(e.ad_account_id)}: ${e.message || "Meta refused the change"}`).join("; ")

  if (errors.length === 0) {
    if (paused === 0) {
      toast.info("Nothing to pause", { description: `${test?.code ?? "This test"} has no live ads ${where}.` })
      return
    }
    toast.success(`Paused ${paused} ${paused === 1 ? "ad" : "ads"}`, { description: `${test?.code ?? "Test"} ${where}` })
    return
  }
  if (paused > 0) {
    toast.warning(`Paused ${paused}, ${errors.length} couldn't be paused`, { description: failed })
    return
  }
  toast.error("Couldn't pause", { description: failed })
}
