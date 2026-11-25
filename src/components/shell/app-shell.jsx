"use client";

import { Suspense, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ClientSwitcher, MenuItem, Rail, RailMenuTile, SetupRing } from "@/components/by";
import { useCredits } from "@/hooks/useCredits";
import { useAgentWorkCount } from "@/lib/agents-api";
import { isActive } from "@/lib/client-status";
import { fetchMe } from "@/lib/admin-api";
import { DEFAULT_DATE_PRESET, SETUP_PATH, isSetupPath } from "@/lib/constants";
import { SETUP_FLAG, setSetupLock } from "@/lib/session";
import { useClientGroups } from "@/lib/useClientGroups";
import { STEPS, allDone, setupHolds } from "@/lib/setup-steps";
import { lockedSections, nextSection, setupPercent, teamDone, useTeamSetup } from "@/lib/team-setup";
import { useSetup } from "@/lib/use-setup";
import { AccountMenu } from "./account-menu";
import { ClientActionsProvider, useClientActions } from "./client-actions";
import { DESTINATIONS, OTHER_PAGES, activeRailId, clientHrefFrom, clientIdFromLocation, clientIdFromPath, isRebuilt, railHref, sectionBase } from "./nav";

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
  // Setup's progress ring, while setup isn't finished. Off /welcome a finished account asks for nothing more.
  const onSetup = pathname === "/welcome";
  const setup = useSetup({ full: onSetup });
  // The agents' interviews count too. Without their state (the request failed) only Birdy's checklist does.
  const { team } = useTeamSetup();
  const birdyLeft = (onSetup || !setup.completed) && !allDone(setup.steps);
  const showSetup = setup.ready && !setup.failed && (birdyLeft || (team !== null && !teamDone(team)));
  const setupPct = setupPercent(setup.steps, team, { completed: setup.completed && setup.steps.plan === "done", total: STEPS.length });
  useSetupLock(setup, pathname, router);
  const hasCredits = credits.status != null && credits.allowance > 0;

  return (
    <ClientActionsProvider clientGroups={clientGroups} onChanged={invalidate}>
    <div className="flex h-screen w-full overflow-hidden">
      <Rail
        className="font-by-body"
        activeId={activeId}
        // Read at click time: the query is not available here without a Suspense boundary.
        onSelect={(id) => router.push(railHref(id, window.location.search))}
        onHome={() => router.push(DESTINATIONS.ops)}
        counts={{ buyer: openWork ?? 0 }}
        locks={lockedSections(team)}
        credits={hasCredits ? { left: credits.balance, percent: (credits.remainingAllowance / credits.allowance) * 100 } : undefined}
        switcher={
          // Reading the address's query needs a Suspense boundary; until it resolves the switcher shows the path's client.
          <Suspense fallback={<WiredSwitcher clients={clients} value={clientIdFromPath(pathname)} onChange={() => {}} status="loading" />}>
            <LocatedSwitcher
              clients={clients}
              // Picking a client inside Marketing Guru or Sales Coach stays there; elsewhere it opens Birdy for it.
              // Leaving a client from an agent section returns to the whole agency there; anywhere else it opens the Clients list.
              onChange={(id) => router.push(id ? clientHrefFrom(pathname, id) : activeId === "ops" && pathname !== `${DESTINATIONS.ops}/context` ? DESTINATIONS.ops : isRebuilt(pathname) && sectionBase(pathname) ? pathname : DESTINATIONS.clients)}
              status={error ? "error" : loading ? "loading" : "ready"}
              onRetry={refresh}
            />
          </Suspense>
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
        setup={showSetup ? (
          <SetupRing
            percent={setupPct}
            active={onSetup}
            onOpen={() => router.push(birdyLeft || !team ? "/welcome?s=ops&checklist=1" : `/welcome?s=${nextSection(team)}`)}
          />
        ) : null}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
    </ClientActionsProvider>
  );
}

/**
 * An account that belongs in setup (unfinished, or finished without a plan)
 * and isn't held there yet, say a session from before plans were required, is
 * held now: the flag and the session cookie go up, and the page goes to setup.
 * From then on ProtectedLayout and the proxy keep it there. An admin, or an
 * admin impersonating an agency, is never held.
 */
function useSetupLock(setup, pathname, router) {
  const holds = setup.ready && !setup.failed && setupHolds(setup.facts.onboarding, setup.steps);
  useEffect(() => {
    if (!holds) return undefined;
    let gone = false;
    (async () => {
      try {
        if (localStorage.getItem(SETUP_FLAG) === "1") return;
        if (JSON.parse(localStorage.getItem("user") || "null")?.role === "admin") return;
      } catch { return; }
      const me = await fetchMe();
      if (gone || me?.impersonating) return;
      setSetupLock(true);
      if (!isSetupPath(pathname)) router.push(SETUP_PATH);
    })();
    return () => { gone = true; };
  }, [holds, pathname, router]);
}

/** The switcher, showing whichever client the current address is narrowed to. */
function LocatedSwitcher(props) {
  const pathname = usePathname();
  const search = useSearchParams();
  return <WiredSwitcher value={clientIdFromLocation(pathname, search.toString())} {...props} />;
}

/** The switcher with "Add new client" wired to the shell's Add client dialog. */
function WiredSwitcher(props) {
  const { openAddClient } = useClientActions();
  return <ClientSwitcher onAddClient={openAddClient} {...props} />;
}
