import { AGENTS, agentInfo } from "@/lib/agent-route";
import { BirdyAvatar } from "./avatar";
import { cn } from "./cn";
import { AgentAvatar } from "./route-map";

// The space between two branch cards. The fork is drawn from it: each half of
// the bar reaches half a gap past its card, so the halves meet in the middle,
// right under the stem, at any width.
const GAP = "1rem";
// How far the bar sits above the cards, and how much its corners curve.
const DROP = 24;
const CORNER = 12;

const LINE = "bg-by-accent-line";
const LINE_BORDER = "border-by-accent-line";

// A one-time arrival: nodes settle upward, lines fade in after the node above
// them. motion-safe only, so under "reduce motion" everything is simply there.
const ENTER = "motion-safe:animate-[by-enter_var(--by-dur-enter)_var(--by-ease-out)_both]";
const FADE = "motion-safe:animate-[by-fade_var(--by-dur-base)_var(--by-ease-out)_both]";
const delay = (step) => ({ animationDelay: `calc(var(--by-stagger) * ${step})` });

/** A short vertical line between two nodes, centred on the tree. */
function Stem({ step }) {
  return <span aria-hidden="true" className={cn("block h-5 w-0.5 shrink-0", LINE, FADE)} style={delay(step)} />;
}

/** Where a line meets a card: a small dot on the card's top edge. */
function Port() {
  return <span aria-hidden="true" className={cn("absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full ring-2 ring-by-surface", LINE)} />;
}

/**
 * The connector above one branch card: its share of the fork bar and the drop
 * into the card's top centre. The outer branches turn their corner with a curve.
 */
function Fork({ index, count, step }) {
  if (count < 2) {
    return <span aria-hidden="true" className={cn("absolute top-0 left-[calc(50%-1px)] w-0.5", LINE, FADE)} style={{ height: DROP, ...delay(step) }} />;
  }
  const first = index === 0;
  const last = index === count - 1;
  const half = `calc(${GAP} / -2)`;
  if (first || last) {
    return (
      <span
        aria-hidden="true"
        className={cn("absolute top-0 border-t-2", first ? "border-l-2" : "border-r-2", LINE_BORDER, FADE)}
        style={{
          height: DROP,
          left: first ? "calc(50% - 1px)" : half,
          right: last ? "calc(50% - 1px)" : half,
          [first ? "borderTopLeftRadius" : "borderTopRightRadius"]: CORNER,
          ...delay(step),
        }}
      />
    );
  }
  return (
    <span aria-hidden="true" className={FADE} style={delay(step)}>
      <span className={cn("absolute top-0 h-0.5", LINE)} style={{ left: half, right: half }} />
      <span className={cn("absolute top-0 left-[calc(50%-1px)] w-0.5", LINE)} style={{ height: DROP }} />
    </span>
  );
}

function Name({ children }) {
  return <b className="block truncate font-by-display text-by-body font-semibold text-by-text">{children}</b>;
}

function Line({ children }) {
  return <small className="block text-by-caption text-by-muted">{children}</small>;
}

const CARD = "relative rounded-by-lg bg-by-surface shadow-by-floating";

function BranchCard({ branch, step }) {
  const info = AGENTS[branch.agent] ?? agentInfo(branch.agent);
  return (
    <div className={cn(CARD, "flex h-full flex-col px-3.5 pt-3 pb-3", ENTER)} style={delay(step)}>
      <Port />
      <div className="flex items-center gap-2.5">
        <AgentAvatar info={info} size={32} />
        <div className="min-w-0">
          <Name>{info.name}</Name>
          {branch.line && <Line>{branch.line}</Line>}
        </div>
      </div>
      {branch.subs?.length > 0 && (
        <div className="mt-3 border-t border-dashed border-by-line pt-2.5">
          <span className="mb-1.5 block text-by-label font-semibold uppercase tracking-[0.06em] text-by-muted">
            {branch.subs.length === 1 ? "Sub-agent" : "Sub-agents"}
          </span>
          <ul className="flex flex-wrap gap-1.5">
            {branch.subs.map((name) => (
              <li key={name} className="inline-flex min-w-0 items-center gap-2 rounded-by-md border border-dashed border-by-line-strong py-1 pr-2.5 pl-1 text-by-caption font-medium text-by-text-2">
                <AgentAvatar info={agentInfo(`sub:${name}`, { name, parent: branch.agent })} />
                <span className="truncate">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Birdy's team drawn as an org chart, for illustration: a question at the top,
 * Birdy under it, then a fork down to the main agents, each card listing what
 * that agent owns and its sub-agents. It shows no data and fetches nothing.
 *
 * Every line is placed from the layout itself (the stem at the centre, the
 * fork from the gap between cards), so the lines meet the cards at any width.
 * Two or three branches read best; give it about 440px or more.
 *
 * @param {string} props.question the example question in the bubble
 * @param {string} props.lead what Birdy does, under its name
 * @param {{agent: string, line?: string, subs?: string[]}[]} props.branches main agents by key ("media_buyer"), each with what it owns and example sub-agent names
 * @param {string} props.label the picture's accessible description
 */
export function TeamTree({ question, lead, branches = [], label, className, ...props }) {
  // Steps of the arrival, top to bottom.
  const S = { bubble: 0, stem1: 2, birdy: 3, stem2: 5, fork: 6, cards: 7 };
  return (
    <div role="img" aria-label={label} className={cn("flex w-full flex-col items-center font-by-body", className)} {...props}>
      {question && (
        <span
          className={cn("max-w-full rounded-by-xl rounded-bl-by-sm bg-by-text px-3.5 py-2 text-center text-by-body-sm font-medium text-by-on-accent shadow-by-raised", ENTER)}
          style={delay(S.bubble)}
        >
          {question}
        </span>
      )}
      {question && <Stem step={S.stem1} />}

      <div className={cn(CARD, "flex w-[21rem] max-w-full items-center gap-3 px-3.5 py-3", ENTER)} style={delay(S.birdy)}>
        {question && <Port />}
        <BirdyAvatar size={40} />
        <div className="min-w-0">
          <Name>{AGENTS.birdy.name}</Name>
          {lead && <Line>{lead}</Line>}
        </div>
      </div>

      {branches.length > 0 && (
        <>
          <Stem step={S.stem2} />
          <ul className="grid w-full" style={{ gap: GAP, gridTemplateColumns: `repeat(${branches.length}, minmax(0, 1fr))` }}>
            {branches.map((branch, i) => (
              <li key={branch.agent} className="relative" style={{ paddingTop: DROP }}>
                <Fork index={i} count={branches.length} step={S.fork} />
                <BranchCard branch={branch} step={S.cards + i} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
