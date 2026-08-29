"use client";

/**
 * The Marketing Hub's client-group filter: a searchable two-column grid of
 * groups behind a chip.
 *
 * Lifted out of MarketingContent when the filters moved into the global top
 * bar — the header renders above the page in the tree, so the control has to be
 * a component the page can hand over rather than markup inside its own render.
 *
 * Every piece of state stays owned by the page. This only draws it.
 */
export function ClientGroupPicker({
  gridRef,
  open,
  setOpen,
  label,
  search,
  setSearch,
  items,
  selectedId,
  onSelect,
}) {
  return (
    <div className="relative" ref={gridRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex h-[38px] min-w-[120px] max-w-[200px] items-center gap-2 rounded-[10px] border border-pd-border bg-pd-surface px-[13px] text-[13px] font-semibold text-pd-body transition-colors hover:bg-pd-divider"
      >
        <span className="flex-1 truncate text-left">{label}</span>
        <svg
          className={`size-3 shrink-0 text-pd-chevron transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-[320px] max-w-[90vw] rounded-xl border border-pd-border bg-pd-surface p-2 shadow-pd-popover">
          <div className="mb-2">
            <input
              type="text"
              placeholder="Search groups…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex h-9 w-full rounded-md border border-pd-border bg-transparent px-3 py-1 text-sm transition-colors placeholder:text-pd-faint focus-visible:ring-1 focus-visible:ring-pd-primary focus-visible:outline-none"
            />
          </div>

          {items.length > 0 ? (
            <div
              className="grid max-h-72 gap-1 overflow-y-auto"
              style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
            >
              {items.map((item) => {
                const isSelected =
                  item.id === "all" ? !selectedId || selectedId === "all" : selectedId === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelect(item.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    title={item.name}
                    className={`truncate rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                      isSelected
                        ? "border-pd-primary bg-pd-primary font-semibold text-white"
                        : "border-pd-border bg-pd-surface text-pd-body hover:bg-pd-divider"
                    }`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-6 py-3 text-center text-xs text-pd-faint">No groups found</p>
          )}
        </div>
      )}
    </div>
  );
}
