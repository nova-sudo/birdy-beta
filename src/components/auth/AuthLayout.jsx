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
 */
export default function AuthLayout({ prompt, linkHref, linkLabel, panelHeadline, panelSub, children }) {
  return (
    <div data-ds="auth-layout" className="flex min-h-svh bg-background text-foreground">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center justify-end gap-1.5 px-4 text-sm">
          <span className="text-muted-foreground">{prompt}</span>
          <a href={linkHref} className="font-medium text-primary hover:underline">
            {linkLabel}
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        <div className="flex h-10 items-center justify-center gap-1.5 px-4 text-xs text-muted-foreground">
          <a href="/billing/terms-of-service" className="hover:text-foreground">Terms</a>
          <span aria-hidden>·</span>
          <a href="/billing/privacy-policy" className="hover:text-foreground">Privacy</a>
        </div>
      </div>
      <div className="hidden w-[680px] lg:block">
        <AuthSilkPanel headline={panelHeadline} sub={panelSub} />
      </div>
    </div>
  )
}
