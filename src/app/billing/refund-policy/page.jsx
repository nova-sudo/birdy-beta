import Head from "next/head";
import Link from "next/link";

function LegalHeader() {
  return (
    <header className="sticky top-0 z-10 bg-background border-b border-border">
      <div className="max-w-4xl mx-auto px-8 py-6 flex items-center gap-3">
        <Link href="/" className="text-xl font-semibold text-foreground">
          Birdy<span className="text-primary">.</span>
        </Link>
        <span className="ml-auto text-xs font-medium text-muted-foreground border border-border rounded-full px-3 py-1">
          Legal
        </span>
      </div>
    </header>
  );
}

function LegalFooter() {
  return (
    <footer className="text-center py-12 border-t border-border text-sm text-muted-foreground">
      <p>
        © 2025 Birdy AI Ltd.&nbsp;&nbsp;·&nbsp;&nbsp;
        <Link href="/billing/terms-of-service" className="hover:text-body">Terms</Link>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        <Link href="/billing/privacy-policy" className="hover:text-body">Privacy</Link>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        <Link href="/billing/refund-policy" className="hover:text-body">Refunds</Link>
      </p>
    </footer>
  );
}

function SectionHeading({ num, children }) {
  return (
    <h2 className="text-xl font-semibold text-foreground mb-5 pb-4 border-b border-border flex items-baseline gap-3">
      <span className="font-sans text-sm font-normal text-muted-foreground">{num}</span>
      {children}
    </h2>
  );
}

function Callout({ children, color = "blue" }) {
  const styles = {
    blue:   "bg-primary-soft   border-primary",
    green:  "bg-success-soft  border-success",
    amber:  "bg-warning-soft  border-warning",
  };
  return (
    <div className={`border-l-4 rounded-r-control px-5 py-4 my-6 text-base text-body ${styles[color]}`}>
      {children}
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul className="mb-4 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="pl-5 relative text-body">
          <span className="absolute left-0 text-muted-foreground">–</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

const SCENARIOS = [
  { tag: "Not eligible",  tagColor: "bg-danger-soft text-danger-ink",     title: "Forgot to cancel",    desc: "Renewals that occur because you forgot to cancel before the billing date are not eligible for refunds." },
  { tag: "Not eligible",  tagColor: "bg-danger-soft text-danger-ink",     title: "Unused subscription", desc: "Not using the Service during a billing period does not entitle you to a refund." },
  { tag: "Not eligible",  tagColor: "bg-danger-soft text-danger-ink",     title: "Plan downgrade",       desc: "Downgrades take effect at the end of the billing period. The current period charge is not refunded." },
  { tag: "Not eligible",  tagColor: "bg-danger-soft text-danger-ink",     title: "Third-party issues",   desc: "Disruptions caused by Meta, GoHighLevel, or HotProspector API outages are outside our control." },
  { tag: "Case by case",  tagColor: "bg-primary-soft text-primary", title: "Extended outage",   desc: "If Birdy experiences a significant outage (4+ hours) preventing use of the Service, we may offer a prorated credit." },
  { tag: "May be eligible", tagColor: "bg-success-soft text-success-ink", title: "Billing error",     desc: "If you were charged incorrectly due to a technical error on our end, we will issue a full refund of the erroneous charge." },
];

const STEPS = [
  { title: "Email us within 7 days",   desc: <>Contact <a href="mailto:billing@birdy.ai" className="text-primary underline underline-offset-2">billing@birdy.ai</a> within 7 days of the charge you are disputing.</> },
  { title: "Include your details",      desc: "Provide your account email, the date of the charge, the amount, and a brief description of the issue." },
  { title: "We'll review and respond", desc: "We aim to respond within 3 business days. If approved, refunds are processed via Whop and typically appear within 5–10 business days." },
];

export default function RefundPolicy() {
  return (
    <>
      <Head>
        <title>Refund Policy — Birdy AI</title>
        <meta name="description" content="Birdy AI Refund Policy" />
      </Head>

      <div className="min-h-screen bg-frame font-sans text-base leading-[1.6] text-body">
        <LegalHeader />

        <main className="max-w-4xl mx-auto px-8 py-16 pb-28">

          {/* Hero */}
          <div className="mb-14 pb-12 border-b border-border">
            <p className="text-xs font-medium tracking-widest uppercase text-primary mb-4">Billing</p>
            <h1 className="mb-5 text-title-sm font-semibold tracking-[-0.02em] text-balance text-foreground md:text-title">Refund Policy</h1>
            <div className="flex gap-6 flex-wrap text-sm text-muted-foreground">
              {["Effective: January 1, 2025", "Last updated: January 1, 2025", "Birdy AI Ltd."].map((t) => (
                <span key={t} className="before:content-['—'] before:mr-2 before:text-border">{t}</span>
              ))}
            </div>
          </div>

          {/* Section 01 — Summary */}
          <section id="summary" className="mb-14 scroll-mt-24">
            <SectionHeading num="01">Summary</SectionHeading>
            <Callout color="blue">
              <strong className="text-primary">The short version:</strong> Birdy subscriptions are generally non-refundable. If you experience a technical issue on our end that prevents you from using the Service, we&apos;ll work with you — either with a credit or a prorated refund at our discretion.
            </Callout>
            <p className="text-body">We want to be transparent and fair. This policy explains exactly when refunds are and aren&apos;t available, and how to request one if you believe you qualify.</p>
          </section>

          {/* Section 02 — General */}
          <section id="general" className="mb-14 scroll-mt-24">
            <SectionHeading num="02">General Policy</SectionHeading>
            <p className="text-body mb-4">All subscription fees paid to Birdy AI are <strong className="font-medium">non-refundable</strong> by default. This includes:</p>
            <BulletList items={[
              "Monthly subscription charges (Starter, Growth, Scale)",
              "Extra client slot purchases",
              "Charges for any partial billing period",
              "Charges following an automatic subscription renewal",
            ]} />
            <p className="text-body">When you subscribe, you have immediate access to the full Service. Because digital access is provided instantly, we are unable to offer refunds simply because you no longer wish to use the Service or forgot to cancel before a renewal date.</p>
          </section>

          {/* Section 03 — Scenarios */}
          <section id="scenarios" className="mb-14 scroll-mt-24">
            <SectionHeading num="03">Refund Scenarios</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              {SCENARIOS.map((s) => (
                <div key={s.title} className="bg-background border border-border rounded-surface p-5">
                  <span className={`text-xs font-bold tracking-[.04em] uppercase px-2.5 py-1 rounded-full inline-block mb-3 ${s.tagColor}`}>
                    {s.tag}
                  </span>
                  <h3 className="text-base font-semibold text-foreground mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 04 — Cancellation */}
          <section id="cancellation" className="mb-14 scroll-mt-24">
            <SectionHeading num="04">Cancellation</SectionHeading>
            <p className="text-body mb-4">You may cancel your subscription at any time. Here&apos;s what happens:</p>
            <BulletList items={[
              "Your access continues until the end of your current paid billing period",
              "You will not be charged again after cancellation",
              "No partial refunds are issued for the unused portion of your current period",
              "Your data is retained for 30 days after expiry, then deleted",
            ]} />
            <Callout color="green">
              <strong className="text-success-ink">How to cancel:</strong> Go to the{" "}
              <Link href="/billing" className="text-primary underline underline-offset-2">Billing page</Link>{" "}
              and click &quot;Manage Billing&quot; to access the Whop customer portal, where you can cancel at any time.
            </Callout>
          </section>

          {/* Section 05 — How to Request */}
          <section id="request" className="mb-14 scroll-mt-24">
            <SectionHeading num="05">How to Request a Refund</SectionHeading>
            <p className="text-body mb-6">If you believe you have a valid refund claim (e.g., a billing error), please follow these steps:</p>
            <div className="space-y-6">
              {STEPS.map((step, i) => (
                <div key={i} className="flex gap-5">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-medium mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-1">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <Callout color="amber">
              <strong className="text-warning-ink">Note:</strong> Refunds are issued at the sole discretion of Birdy AI Ltd. Submitting a request does not guarantee a refund.
            </Callout>
          </section>

          {/* Section 06 — Disputes */}
          <section id="disputes" className="mb-14 scroll-mt-24">
            <SectionHeading num="06">Chargebacks & Disputes</SectionHeading>
            <p className="text-body mb-4">If you initiate a chargeback with your bank or card issuer without first contacting us, we reserve the right to suspend your account pending resolution of the dispute.</p>
            <p className="text-body">
              We encourage you to reach out to us directly at{" "}
              <a href="mailto:billing@birdy.ai" className="text-primary underline underline-offset-2">billing@birdy.ai</a>{" "}
              — we&apos;re happy to work through any billing issue with you quickly and fairly.
            </p>
          </section>

          {/* Section 07 — Contact */}
          <section id="contact" className="mb-14 scroll-mt-24">
            <SectionHeading num="07">Contact</SectionHeading>
            <p className="text-body mb-4">For billing or refund enquiries:</p>
            <BulletList items={[
              <span key="email"><strong className="font-medium">Email:</strong> <a href="mailto:billing@birdy.ai" className="text-primary underline underline-offset-2">billing@birdy.ai</a></span>,
              <span key="web"><strong className="font-medium">Website:</strong> <a href="https://birdy-beta.vercel.app" className="text-primary underline underline-offset-2">birdy-beta.vercel.app</a></span>,
            ]} />
          </section>
        </main>

        <LegalFooter />
      </div>
    </>
  );
}
