"use client";

import { PdSegmented } from "./PdSegmented";

/**
 * A fixed-width rail whose panels share one scroll area.
 *
 * Only the selected panel renders. That was a design decision rather than an
 * optimisation: an earlier stacked two-pane version put two scrollbars in a
 * 340px rail and was rejected.
 *
 * @param {{key, label, badge?, badgeClassName?, render: () => React.ReactNode,
 *          isEmpty?: boolean, status?: string}[]} panels
 */
export function SidePanel({
  panels,
  active,
  onChange,
  label = "Panel",
  id = "pd-side-panel",
  emptyMessage = "Nothing here right now",
  // The default is the page rail this was built for. Client Detail stacks the
  // same control as a card in a column, where a left border and a fixed width
  // would both be wrong — hence overridable rather than baked in.
  className = "w-[340px] border-l border-pd-border",
  itemClassName = "flex-1 p-2",
}) {
  const current = panels.find((p) => p.key === active) ?? panels[0];

  return (
    <aside className={`flex shrink-0 flex-col bg-pd-surface ${className}`}>
      <div className="shrink-0 border-b border-pd-divider px-5 py-4">
        <PdSegmented
          role="tablist"
          label={label}
          panelId={id}
          options={panels.map(({ key, label: l, badge, badgeClassName }) => ({
            key,
            label: l,
            badge,
            badgeClassName,
          }))}
          value={current.key}
          onChange={onChange}
          itemClassName={itemClassName}
        />
      </div>

      <div
        id={id}
        role="tabpanel"
        tabIndex={0}
        aria-label={current.label}
        className="pd-scrolly min-h-0 flex-1 px-5 py-4"
      >
        {/* Acting on a card removes it, which is otherwise silent. */}
        {current.status && (
          <p role="status" className="sr-only">
            {current.status}
          </p>
        )}

        {current.isEmpty ? (
          <p className="py-8 text-center text-[12px] text-pd-faint">
            {current.emptyMessage ?? emptyMessage}
          </p>
        ) : (
          current.render()
        )}
      </div>
    </aside>
  );
}
