import Head from "next/head";
import Link from "next/link";

const SECTIONS = [
  { id: "acceptance",    num: "01", title: "Acceptance of Terms" },
  { id: "services",     num: "02", title: "Description of Services" },
  { id: "accounts",     num: "03", title: "Accounts & Registration" },
  { id: "subscriptions",num: "04", title: "Subscriptions & Billing" },
  { id: "use",          num: "05", title: "Acceptable Use" },
  { id: "data",         num: "06", title: "Data & Privacy" },
  { id: "ip",           num: "07", title: "Intellectual Property" },
  { id: "disclaimers",  num: "08", title: "Disclaimers" },
  { id: "liability",    num: "09", title: "Limitation of Liability" },
  { id: "termination",  num: "10", title: "Termination" },
  { id: "governing",    num: "11", title: "Governing Law" },
  { id: "contact",      num: "12", title: "Contact" },
];

function LegalHeader() {
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="max-w-4xl mx-auto px-8 py-6 flex items-center gap-3">
        <Link href="/" className="font-serif text-xl font-semibold text-gray-900">
          Birdy<span className="text-blue-600">.</span>
        </Link>
        <span className="ml-auto text-xs font-medium text-gray-400 border border-gray-200 rounded-full px-3 py-1">
          Legal
        </span>
      </div>
    </header>
  );
}

function LegalFooter() {
  return (
    <footer className="text-center py-12 border-t border-gray-200 text-sm text-gray-400">
      <p>
        © 2025 Birdy AI Ltd.&nbsp;&nbsp;·&nbsp;&nbsp;
        <Link href="/terms-of-service" className="hover:text-gray-600">Terms</Link>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        <Link href="/privacy-policy" className="hover:text-gray-600">Privacy</Link>
        &nbsp;&nbsp;·&nbsp;&nbsp;
        <Link href="/refund-policy" className="hover:text-gray-600">Refunds</Link>
      </p>
    </footer>
  );
}

function SectionHeading({ num, children }) {
  return (
    <h2 className="font-serif text-2xl font-semibold mb-5 pb-4 border-b border-gray-200 flex items-baseline gap-3">
      <span className="font-sans text-sm font-normal text-gray-400">{num}</span>
      {children}
    </h2>
  );
}

function Callout({ children }) {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg px-5 py-4 my-6 text-[15px] text-gray-700">
      {children}
    </div>
  );
}

function BulletList({ items }) {
  return (
    <ul className="mb-4 space-y-2">
      {items.map((item, i) => (
        <li key={i} className="pl-5 relative text-gray-700">
          <span className="absolute left-0 text-gray-400">–</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function TermsOfService() {
  return (
    <>
      <Head>
        <title>Terms of Service — Birdy AI</title>
        <meta name="description" content="Birdy AI Terms of Service" />
      </Head>

      <div className="min-h-screen bg-[#fafaf8] font-sans">
        <LegalHeader />

        <main className="max-w-4xl mx-auto px-8 py-16 pb-28">

          {/* Hero */}
          <div className="mb-14 pb-12 border-b border-gray-200">
            <p className="text-xs font-medium tracking-widest uppercase text-blue-600 mb-4">Legal Agreement</p>
            <h1 className="font-serif text-5xl font-semibold leading-tight tracking-tight mb-5">Terms of Service</h1>
            <div className="flex gap-6 flex-wrap text-sm text-gray-400">
              {["Effective: January 1, 2025", "Last updated: January 1, 2025", "Birdy AI Ltd."].map((t) => (
                <span key={t} className="before:content-['—'] before:mr-2 before:text-gray-200">{t}</span>
              ))}
            </div>
          </div>

          {/* TOC */}
          <nav className="bg-white border border-gray-200 rounded-xl px-8 py-7 mb-14">
            <p className="text-xs font-medium tracking-widest uppercase text-gray-400 mb-4">Contents</p>
            <ol className="grid grid-cols-2 gap-2 list-none">
              {SECTIONS.map((s) => (
                <li key={s.id} className="text-sm">
                  <a href={`#${s.id}`} className="flex items-center gap-2 text-gray-800 hover:text-blue-600 no-underline group">
                    <span className="text-xs text-gray-400 w-5">{s.num}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* Sections */}
          <section id="acceptance" className="mb-14 scroll-mt-24">
            <SectionHeading num="01">Acceptance of Terms</SectionHeading>
            <p className="text-gray-700 mb-4">By accessing or using Birdy AI ("the Service", "Birdy", "we", "us"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.</p>
            <p className="text-gray-700">These Terms constitute a legally binding agreement between you and Birdy AI Ltd. We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the revised Terms.</p>
          </section>

          <section id="services" className="mb-14 scroll-mt-24">
            <SectionHeading num="02">Description of Services</SectionHeading>
            <p className="text-gray-700 mb-4">Birdy AI is a client management and marketing analytics platform for marketing agencies. The Service enables you to:</p>
            <BulletList items={[
              "Connect and manage multiple client accounts through GoHighLevel, Meta Ads, and HotProspector integrations",
              "Track campaign performance, leads, and marketing metrics across platforms",
              "Set alerts and automate reporting for client campaigns",
              "Access aggregated analytics dashboards for your client portfolio",
            ]} />
            <p className="text-gray-700">We reserve the right to modify, suspend, or discontinue any part of the Service at any time with reasonable notice.</p>
          </section>

          <section id="accounts" className="mb-14 scroll-mt-24">
            <SectionHeading num="03">Accounts & Registration</SectionHeading>
            <p className="text-gray-700 mb-4">To use Birdy, you must create an account with a valid email address and password. You are responsible for:</p>
            <BulletList items={[
              "Maintaining the confidentiality of your login credentials",
              "All activity that occurs under your account",
              "Notifying us immediately of any unauthorized access",
              "Ensuring all account information is accurate and up to date",
            ]} />
            <p className="text-gray-700">You must be at least 18 years old to create an account. Accounts may not be shared or transferred without our prior written consent.</p>
          </section>

          <section id="subscriptions" className="mb-14 scroll-mt-24">
            <SectionHeading num="04">Subscriptions & Billing</SectionHeading>
            <p className="text-gray-700 mb-4">Birdy is offered on a subscription basis. By subscribing, you agree to the following:</p>
            <BulletList items={[
              "Billing cycles: Subscriptions are billed monthly in advance via Paddle, our payment processor.",
              "Automatic renewal: Subscriptions renew automatically unless cancelled before the renewal date.",
              "Plan changes: Upgrades take effect immediately with prorated billing. Downgrades take effect at the end of the current billing period.",
              "Extra client slots: Available on the Scale plan at $10/mo each, charged at time of purchase.",
              "Refunds: Payments are generally non-refundable. Please see our Refund Policy for details.",
            ]} />
            <Callout>
              <strong className="text-blue-600">Note:</strong> All billing is handled by Paddle. By subscribing, you also agree to Paddle&apos;s terms of service. Birdy does not store your payment card details.
            </Callout>
          </section>

          <section id="use" className="mb-14 scroll-mt-24">
            <SectionHeading num="05">Acceptable Use</SectionHeading>
            <p className="text-gray-700 mb-4">You agree not to use Birdy to:</p>
            <BulletList items={[
              "Violate any applicable law or regulation",
              "Infringe the intellectual property rights of any third party",
              "Transmit spam, malware, or any harmful content",
              "Attempt to gain unauthorized access to any part of the Service or its infrastructure",
              "Scrape, reverse-engineer, or attempt to extract source code from the Service",
              "Use the Service in any way that could damage, disable, or overburden our infrastructure",
              "Misrepresent your identity or your clients' data within the platform",
            ]} />
            <p className="text-gray-700">Violation of these restrictions may result in immediate account suspension or termination.</p>
          </section>

          <section id="data" className="mb-14 scroll-mt-24">
            <SectionHeading num="06">Data & Privacy</SectionHeading>
            <p className="text-gray-700 mb-4">Your use of the Service is also governed by our <Link href="/privacy-policy" className="text-blue-600 underline underline-offset-2">Privacy Policy</Link>, which is incorporated into these Terms by reference.</p>
            <p className="text-gray-700 mb-4">You retain ownership of all data you input into or generate through the Service. By using Birdy, you grant us a limited license to process your data solely for the purpose of providing the Service.</p>
            <p className="text-gray-700">You are responsible for ensuring you have the right to share any third-party client data you input into the platform, including compliance with applicable data protection laws (e.g., GDPR, CCPA).</p>
          </section>

          <section id="ip" className="mb-14 scroll-mt-24">
            <SectionHeading num="07">Intellectual Property</SectionHeading>
            <p className="text-gray-700 mb-4">The Birdy platform, including its software, design, trademarks, and content, is owned by Birdy AI Ltd. and protected by intellectual property laws. Nothing in these Terms grants you ownership of any Birdy intellectual property.</p>
            <p className="text-gray-700">You may not copy, reproduce, distribute, or create derivative works from any part of the Service without our express written permission.</p>
          </section>

          <section id="disclaimers" className="mb-14 scroll-mt-24">
            <SectionHeading num="08">Disclaimers</SectionHeading>
            <p className="text-gray-700 mb-4">The Service is provided <strong className="font-medium">&quot;as is&quot;</strong> and <strong className="font-medium">&quot;as available&quot;</strong> without warranties of any kind. We do not warrant that:</p>
            <BulletList items={[
              "The Service will be uninterrupted, error-free, or secure",
              "Any data retrieved from third-party integrations (Meta, GoHighLevel, HotProspector) will be accurate or complete",
              "The Service will meet your specific business requirements",
            ]} />
            <p className="text-gray-700">Third-party integrations are subject to the terms and availability of those platforms. Birdy is not responsible for changes, outages, or data issues originating from third-party APIs.</p>
          </section>

          <section id="liability" className="mb-14 scroll-mt-24">
            <SectionHeading num="09">Limitation of Liability</SectionHeading>
            <p className="text-gray-700 mb-4">To the maximum extent permitted by law, Birdy AI Ltd. shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including loss of profits, loss of data, or business interruption.</p>
            <p className="text-gray-700">Our total liability to you for any claim shall not exceed the amount you paid to us in the 12 months preceding the claim.</p>
          </section>

          <section id="termination" className="mb-14 scroll-mt-24">
            <SectionHeading num="10">Termination</SectionHeading>
            <p className="text-gray-700 mb-4">You may cancel your account at any time via the billing portal. Upon cancellation, your access continues until the end of your current billing period.</p>
            <p className="text-gray-700">We may suspend or terminate your account immediately if you breach these Terms. Upon termination, your right to access the Service ceases and we may delete your data in accordance with our data retention policy.</p>
          </section>

          <section id="governing" className="mb-14 scroll-mt-24">
            <SectionHeading num="11">Governing Law</SectionHeading>
            <p className="text-gray-700 mb-4">These Terms are governed by and construed in accordance with applicable law. Any disputes shall be subject to the exclusive jurisdiction of the relevant courts.</p>
            <p className="text-gray-700">If any provision of these Terms is found to be unenforceable, the remaining provisions will remain in full force and effect.</p>
          </section>

          <section id="contact" className="mb-14 scroll-mt-24">
            <SectionHeading num="12">Contact</SectionHeading>
            <p className="text-gray-700 mb-4">If you have questions about these Terms, please contact us:</p>
            <BulletList items={[
              <span key="email"><strong className="font-medium">Email:</strong> <a href="mailto:legal@birdy.ai" className="text-blue-600 underline underline-offset-2">legal@birdy.ai</a></span>,
              <span key="web"><strong className="font-medium">Website:</strong> <a href="https://birdy-beta.vercel.app" className="text-blue-600 underline underline-offset-2">birdy-beta.vercel.app</a></span>,
            ]} />
          </section>
        </main>

        <LegalFooter />
      </div>
    </>
  );
}
