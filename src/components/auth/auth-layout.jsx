import { BirdyAvatar } from "@/components/by";
import { TeamPanel } from "./team-panel";

/**
 * The sign-in and sign-up pages: the form on a white surface on the left,
 * the team illustration on the right. On phone and tablet the panel drops away.
 *
 * @param {string} [props.birdyState] the mascot's state, e.g. "celebrate" after signing up
 * @param {React.ReactNode} props.legal the line at the foot of the form column
 */
export function AuthLayout({ birdyState, legal, children }) {
  return (
    <div className="grid min-h-svh bg-by-surface font-by-body text-by-text selection:bg-by-accent-line selection:text-by-text lg:grid-cols-[minmax(0,44fr)_minmax(0,56fr)]">
      <main className="flex min-w-0 flex-col px-6 py-6 sm:px-10 sm:py-7">
        <div className="flex items-center gap-2.5">
          <BirdyAvatar size={32} state={birdyState} />
          <span className="font-by-display text-by-body-lg font-semibold">Birdy</span>
        </div>
        {/* On a phone the form sits under the brand, where a thumb and the keyboard expect it; from sm up it is centred. */}
        <div className="flex flex-1 items-start justify-center pt-14 pb-10 sm:items-center sm:py-10">
          <div className="w-full max-w-[22rem]">{children}</div>
        </div>
        <div className="text-by-caption text-by-muted">{legal}</div>
      </main>
      <TeamPanel />
    </div>
  );
}

/** The heading above a form. */
export function AuthHeading({ title, children }) {
  return (
    <div className="mb-6">
      <h1 className="font-by-display text-by-title font-semibold text-by-text">{title}</h1>
      <p className="mt-1 text-by-body text-by-muted">{children}</p>
    </div>
  );
}

const LINK = "font-medium text-by-accent underline-offset-2 hover:text-by-accent-hover hover:underline";

/** Terms of Service and Privacy Policy, with an optional sentence around them. */
export function LegalLinks({ lead }) {
  const terms = <a href="/billing/terms-of-service" className={LINK}>Terms of Service</a>;
  const privacy = <a href="/billing/privacy-policy" className={LINK}>Privacy Policy</a>;
  if (lead) return <p>{lead} {terms} and {privacy}.</p>;
  return <p className="[&_a]:text-by-muted [&_a]:hover:text-by-text">{terms}<span aria-hidden="true"> · </span>{privacy}</p>;
}

/** "New to Birdy? Create an account" and its mirror on the other page. */
export function SwitchLink({ prompt, href, children }) {
  return (
    <p className="mt-5 text-by-body-sm text-by-muted">
      {prompt} <a href={href} className={LINK}>{children}</a>
    </p>
  );
}
