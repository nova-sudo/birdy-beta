import Link from "next/link"
import AuthSilkPanel from "./AuthSilkPanel"

/**
 * Two-column auth page, no app shell: the form column on the left (switch-page
 * prompt on top, form centred, legal links underneath), the Silk panel on the
 * right from lg up.
 *
 * @param {object} props
 * @param {React.ReactNode} props.prompt Muted text before the switch link
 * @param {string} props.linkHref
 * @param {string} props.linkLabel
 * @param {React.ReactNode} props.panelHeadline
 * @param {React.ReactNode} props.panelSub
 * @param {boolean} [props.showLegal=true] Terms · Privacy row under the form; off where the form carries its own terms sentence
 */
export default function AuthLayout({ prompt, linkHref, linkLabel, panelHeadline, panelSub, showLegal = true, children }) {
  return (
    <div data-ds="auth-layout" className="flex min-h-svh bg-background text-foreground">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center justify-end gap-1.5 px-4 text-sm">
          <span className="text-muted-foreground">{prompt}</span>
          <Link href={linkHref} className="font-medium text-primary hover:underline">
            {linkLabel}
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        {showLegal ? (
          <div className="flex h-10 items-center justify-center gap-1.5 px-4 text-xs text-muted-foreground">
            <Link href="/billing/terms-of-service" className="hover:text-foreground">Terms</Link>
            <span aria-hidden>·</span>
            <Link href="/billing/privacy-policy" className="hover:text-foreground">Privacy</Link>
          </div>
        ) : (
          <div className="h-10" />
        )}
      </div>
      <div className="hidden w-[680px] lg:block">
        <AuthSilkPanel headline={panelHeadline} sub={panelSub} />
      </div>
    </div>
  )
}
