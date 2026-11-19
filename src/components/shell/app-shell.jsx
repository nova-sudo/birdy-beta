"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClientSwitcher, MenuItem, Rail, RailMenuTile } from "@/components/by";
import { useCredits } from "@/hooks/useCredits";
import { useAgentWorkCount } from "@/lib/agents-api";
import { isActive } from "@/lib/client-status";
import { DEFAULT_DATE_PRESET } from "@/lib/constants";
import { useClientGroups } from "@/lib/useClientGroups";
import { AccountMenu } from "./account-menu";
import { ClientActionsProvider, useClientActions } from "./client-actions";
import { DESTINATIONS, OTHER_PAGES, activeRailId, clientHref, clientIdFromPath } from "./nav";

// Hand-set health -> the switcher's dot. An inactive client gets no colour.
const HEALTH_DOT = { Critical: "danger", Warning: "warning", Healthy: "success" };

/**
 * The app's frame: the rail on the left, the page on the right.
 *
 * This is the wiring. The rail and its parts come from the kit and take
 * everything as props; this component fetches the data and knows the routes.
 *
 */
export function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const credits = useCredits();
  const openWork = useAgentWorkCount();
  // Totals only: nothing on the rail plots a trend, and the per-day series is
  // most of the payload. The Clients list asks for the same variant, so the
  // two share one request.
  const { clientGroups, loading, error, refresh, invalidate } = useClientGroups(DEFAULT_DATE_PRESET, { includeDaily: false });

  const clients = useMemo(
    () =>
      clientGroups.map((group) => ({
        id: group.id,
        name: group.name,
        status: isActive(group) ? HEALTH_DOT[group.health] ?? "success" : undefined,
      })),
    [clientGroups],
  );

  const activeId = activeRailId(pathname);
  const hasCredits = credits.status != null && credits.allowance > 0;

  return (
    <ClientActionsProvider clientGroups={clientGroups} onChanged={invalidate}>
    <div className="flex h-screen w-full overflow-hidden">
      <Rail
        className="font-by-body"
        activeId={activeId}
        onSelect={(id) => router.push(DESTINATIONS[id])}
        counts={{ buyer: openWork ?? 0 }}
        credits={hasCredits ? { left: credits.balance, percent: (credits.remainingAllowance / credits.allowance) * 100 } : undefined}
        switcher={
          <WiredSwitcher
            clients={clients}
            value={clientIdFromPath(pathname)}
            onChange={(id) => router.push(id ? clientHref(id) : DESTINATIONS.clients)}
            status={error ? "error" : loading ? "loading" : "ready"}
            onRetry={refresh}
          />
        }
        extra={
          <RailMenuTile label="Other pages" active={activeId === "other"}>
            {OTHER_PAGES.map(({ label, href, icon: Icon }) => (
              <MenuItem key={href} selected={pathname === href || pathname.startsWith(`${href}/`)} onSelect={() => router.push(href)}>
                <Icon aria-hidden="true" />
                {label}
              </MenuItem>
            ))}
          </RailMenuTile>
        }
        account={<AccountMenu />}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
    </ClientActionsProvider>
  );
}

/** The switcher with "Add new client" wired to the shell's Add client dialog. */
function WiredSwitcher(props) {
  const { openAddClient } = useClientActions();
  return <ClientSwitcher onAddClient={openAddClient} {...props} />;
}
