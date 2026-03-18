import Head from "next/head";
import Link from "next/link";

const SECTIONS = [
  { id: "overview",      num: "01", title: "Overview" },
  { id: "collect",       num: "02", title: "Data We Collect" },
  { id: "use",           num: "03", title: "How We Use Your Data" },
  { id: "third-parties", num: "04", title: "Third-Party Integrations" },
  { id: "sharing",       num: "05", title: "Data Sharing" },
  { id: "retention",     num: "06", title: "Data Retention" },
  { id: "security",      num: "07", title: "Security" },
  { id: "rights",        num: "08", title: "Your Rights" },
  { id: "cookies",       num: "09", title: "Cookies" },
  { id: "children",      num: "10", title: "Children's Privacy" },
  { id: "changes",       num: "11", title: "Changes to This Policy" },
  { id: "contact",       num: "12", title: "Contact Us" },
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

function Callout({ children, color = "blue" }) {
  const styles = {
    blue:  "bg-blue-50 border-blue-500 text-gray-700",
    green: "bg-green-50 border-green-500 text-gray-700",
  };
  return (
    <div className={`border-l-4 rounded-r-lg px-5 py-4 my-6 text-[15px] ${styles[color]}`}>
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

const DATA_ROWS = [
  { category: "Account data",     examples: "Name, email address, password (hashed)",                                         source: "Provided by you at registration" },
  { category: "Billing data",     examples: "Subscription plan, billing status",                                              source: "Paddle (payment processor)" },
  { category: "Integration data", examples: "OAuth tokens for GoHighLevel, Meta, HotProspector",                              source: "Third-party authorization flows" },
  { category: "Client data",      examples: "Contact lists, campaign metrics, lead data from your connected accounts",         source: "Pulled from third-party APIs on your behalf" },
  { category: "Usage data",       examples: "Pages visited, features used, timestamps",                                        source: "Automatically collected" },
  { category: "Technical data",   examples: "IP address, browser type, device info",                                           source: "Automatically collected" },
];

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy — Birdy AI</title>
        <meta name="description" content="Birdy AI Privacy Policy" />
      </Head>

      <div className="min-h-screen bg-[#fafaf8] font-sans">
        <LegalHeader />

        <main className="max-w-4xl mx-auto px-8 py-16 pb-28">

          {/* Hero */}
          <div className="mb-14 pb-12 border-b border-gray-200">
            <p className="text-xs font-medium tracking-widest uppercase text-blue-600 mb-4">Privacy</p>
            <h1 className="font-serif text-5xl font-semibold leading-tight tracking-tight mb-5">Privacy Policy</h1>
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
                  <a href={`#${s.id}`} className="flex items-center gap-2 text-gray-800 hover:text-blue-600 no-underline">
                    <span className="text-xs text-gray-400 w-5">{s.num}</span>
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <section id="overview" className="mb-14 scroll-mt-24">
            <SectionHeading num="01">Overview</SectionHeading>
            <p className="text-gray-700 mb-4">Birdy AI Ltd. (&quot;Birdy&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your personal information when you use the Birdy platform.</p>
            <p className="text-gray-700">By using Birdy, you agree to the collection and use of information as described in this policy.</p>
          </section>

          <section id="collect" className="mb-14 scroll-mt-24">
            <SectionHeading num="02">Data We Collect</SectionHeading>
            <p className="text-gray-700 mb-4">We collect the following categories of information:</p>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">Examples</th>
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-400">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {DATA_ROWS.map((row, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{row.category}</td>
                      <td className="px-4 py-3 text-gray-600">{row.examples}</td>
                      <td className="px-4 py-3 text-gray-500">{row.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="use" className="mb-14 scroll-mt-24">
            <SectionHeading num="03">How We Use Your Data</SectionHeading>
            <p className="text-gray-700 mb-4">We use the data we collect to:</p>
            <BulletList items={[
              "Provide, operate, and maintain the Birdy platform",
              "Process payments and manage your subscription",
              "Sync and display data from your connected third-party integrations",
              "Send service notifications (account updates, billing alerts, security notices)",
              "Diagnose technical issues and improve the Service",
              "Comply with legal obligations",
            ]} />
            <p className="text-gray-700">We do not use your data for advertising purposes or sell it to third parties.</p>
          </section>

          <section id="third-parties" className="mb-14 scroll-mt-24">
            <SectionHeading num="04">Third-Party Integrations</SectionHeading>
            <p className="text-gray-700 mb-4">Birdy connects to the following third-party platforms on your behalf:</p>
            <BulletList items={[
              <span key="ghl"><strong className="font-medium">GoHighLevel</strong> — CRM contacts and subaccount data</span>,
              <span key="meta"><strong className="font-medium">Meta (Facebook)</strong> — Ad account campaigns, leads, and insights</span>,
              <span key="hp"><strong className="font-medium">HotProspector</strong> — Lead and call log data</span>,
            ]} />
            <p className="text-gray-700 mb-4">When you connect these services, you authorize Birdy to access and store data from those platforms. The data pulled is used solely to populate your Birdy dashboard.</p>
            <Callout color="green">
              <strong className="text-green-700">Your control:</strong> You can disconnect any integration at any time from the Settings page. Upon disconnection, we stop pulling new data from that platform.
            </Callout>
            <p className="text-gray-700">
              Billing is processed by <strong className="font-medium">Paddle</strong>. We do not store payment card details. Please review{" "}
              <a href="https://www.paddle.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline underline-offset-2">
                Paddle&apos;s Privacy Policy
              </a>{" "}
              for how they handle payment data.
            </p>
          </section>

          <section id="sharing" className="mb-14 scroll-mt-24">
            <SectionHeading num="05">Data Sharing</SectionHeading>
            <p className="text-gray-700 mb-4">We do not sell, rent, or trade your personal information. We may share data only in these circumstances:</p>
            <BulletList items={[
              <span key="sp"><strong className="font-medium">Service providers:</strong> Trusted vendors who help operate the Service (e.g., cloud hosting, payment processing), under strict confidentiality agreements</span>,
              <span key="legal"><strong className="font-medium">Legal requirements:</strong> If required by law, court order, or government authority</span>,
              <span key="biz"><strong className="font-medium">Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, with appropriate notice to you</span>,
            ]} />
          </section>

          <section id="retention" className="mb-14 scroll-mt-24">
            <SectionHeading num="06">Data Retention</SectionHeading>
            <p className="text-gray-700 mb-4">We retain your data for as long as your account is active or as needed to provide the Service:</p>
            <BulletList items={[
              "Account data: Retained until you delete your account",
              "Integration data: Retained while active; removed within 30 days of disconnection",
              "Billing records: Retained for 7 years as required for financial compliance",
              "Usage logs: Retained for up to 90 days",
            ]} />
            <p className="text-gray-700">Upon account deletion, we will delete or anonymize your personal data within 30 days, unless retention is required by law.</p>
          </section>

          <section id="security" className="mb-14 scroll-mt-24">
            <SectionHeading num="07">Security</SectionHeading>
            <p className="text-gray-700 mb-4">We implement industry-standard security measures to protect your data:</p>
            <BulletList items={[
              "HTTPS encryption for all data in transit",
              "Bcrypt password hashing — we never store plaintext passwords",
              "JWT-based authentication with short-lived access tokens",
              "MongoDB access controls and network isolation",
            ]} />
            <p className="text-gray-700">
              No system is 100% secure. If you believe your account has been compromised, contact us immediately at{" "}
              <a href="mailto:security@birdy.ai" className="text-blue-600 underline underline-offset-2">security@birdy.ai</a>.
            </p>
          </section>

          <section id="rights" className="mb-14 scroll-mt-24">
            <SectionHeading num="08">Your Rights</SectionHeading>
            <p className="text-gray-700 mb-4">Depending on your location, you may have the following rights regarding your personal data:</p>
            <BulletList items={[
              <span key="a"><strong className="font-medium">Access:</strong> Request a copy of the personal data we hold about you</span>,
              <span key="c"><strong className="font-medium">Correction:</strong> Request correction of inaccurate data</span>,
              <span key="d"><strong className="font-medium">Deletion:</strong> Request deletion of your personal data (&quot;right to be forgotten&quot;)</span>,
              <span key="p"><strong className="font-medium">Portability:</strong> Request your data in a portable format</span>,
              <span key="o"><strong className="font-medium">Objection:</strong> Object to certain processing of your data</span>,
            ]} />
            <p className="text-gray-700">
              To exercise any of these rights, email{" "}
              <a href="mailto:privacy@birdy.ai" className="text-blue-600 underline underline-offset-2">privacy@birdy.ai</a>.
              We will respond within 30 days.
            </p>
          </section>

          <section id="cookies" className="mb-14 scroll-mt-24">
            <SectionHeading num="09">Cookies</SectionHeading>
            <p className="text-gray-700 mb-4">Birdy uses only essential cookies:</p>
            <BulletList items={[
              <span key="auth"><strong className="font-medium">auth_token:</strong> HTTP-only authentication cookie. Required to stay logged in. No tracking purpose.</span>,
              <span key="refresh"><strong className="font-medium">refresh_token:</strong> HTTP-only refresh token for seamless session renewal. No tracking purpose.</span>,
            ]} />
            <p className="text-gray-700">We do not use advertising cookies or third-party tracking cookies. Disabling cookies will prevent you from logging into Birdy.</p>
          </section>

          <section id="children" className="mb-14 scroll-mt-24">
            <SectionHeading num="10">Children&apos;s Privacy</SectionHeading>
            <p className="text-gray-700">Birdy is not directed at children under the age of 18. We do not knowingly collect personal information from minors. If we become aware that a minor has provided personal data, we will delete it promptly.</p>
          </section>

          <section id="changes" className="mb-14 scroll-mt-24">
            <SectionHeading num="11">Changes to This Policy</SectionHeading>
            <p className="text-gray-700 mb-4">We may update this Privacy Policy from time to time. We will notify you of significant changes by email or via an in-app notice. The &quot;Last updated&quot; date at the top of this page reflects the most recent revision.</p>
            <p className="text-gray-700">Continued use of the Service after changes take effect constitutes your acceptance of the revised policy.</p>
          </section>

          <section id="contact" className="mb-14 scroll-mt-24">
            <SectionHeading num="12">Contact Us</SectionHeading>
            <p className="text-gray-700 mb-4">For privacy-related questions or to exercise your data rights:</p>
            <BulletList items={[
              <span key="email"><strong className="font-medium">Email:</strong> <a href="mailto:privacy@birdy.ai" className="text-blue-600 underline underline-offset-2">privacy@birdy.ai</a></span>,
              <span key="web"><strong className="font-medium">Website:</strong> <a href="https://birdy-beta.vercel.app" className="text-blue-600 underline underline-offset-2">birdy-beta.vercel.app</a></span>,
            ]} />
          </section>
        </main>

        <LegalFooter />
      </div>
    </>
  );
}
