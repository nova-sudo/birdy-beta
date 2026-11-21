import { markParts } from "@/lib/lead-view";

/**
 * Text with the thread search's matches marked. The current match is ringed and
 * carries data-current, so the thread can scroll to it.
 * @param {number|undefined} props.base the number of this text's first match (from findHits), or undefined when it has none
 */
export function Marked({ text, query, base, current }) {
  return markParts(text, query, base).map((part, i) =>
    part.hit === undefined ? (
      part.text
    ) : (
      <mark
        key={i}
        data-current={part.hit === current || undefined}
        className={part.hit === current ? "rounded-[3px] bg-by-warning-bg text-by-text outline-2 outline-by-warning-solid" : "rounded-[3px] bg-by-warning-bg text-by-text"}
      >
        {part.text}
      </mark>
    ),
  );
}
