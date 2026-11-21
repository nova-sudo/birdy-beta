import { TeamTree } from "@/components/by";

// An illustration only: the question and the sub-agent names are examples,
// and nothing here is fetched or counted.
const BRANCHES = [
  { agent: "media_buyer", line: "Spend, cost per lead, creatives", subs: ["Budget watcher"] },
  { agent: "sales_coach", line: "Call trends, recordings, deals", subs: ["Weekly call check"] },
];

/** The right-hand side of the sign-in pages: Birdy's team, drawn as a tree. */
export function TeamPanel() {
  return (
    <aside
      aria-label="About Birdy"
      className="relative hidden items-center justify-center border-l border-by-line bg-by-canvas bg-[radial-gradient(circle_at_1px_1px,var(--by-line-strong)_1px,transparent_1.5px)] bg-size-[22px_22px] px-10 py-12 lg:flex xl:px-14"
    >
      <div className="w-full max-w-[36rem]">
        <h2 className="text-balance font-by-display text-by-title font-semibold text-by-text">
          Your agency’s team, already at work.
        </h2>
        <p className="mt-1.5 text-by-body-lg text-by-text-2">
          Ask once. Birdy passes it down to whoever owns it.
        </p>
        <TeamTree
          className="mt-10"
          question="Why did calls drop this week?"
          lead="Runs the agency view and hands work out"
          branches={BRANCHES}
          label="An example: a question goes to Birdy, who passes it to Media Buyer or Sales Coach. Each has sub-agents of its own."
        />
      </div>
    </aside>
  );
}
