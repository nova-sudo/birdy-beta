"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

// The two ways of adding clients can be started from several places (the
// client switcher, the Clients page), so the dialogs live once in the shell
// and anything below it opens them through this context.

const AddClientDialog = dynamic(() => import("@/components/clients/add-client/add-client-dialog").then((m) => m.AddClientDialog), { ssr: false });

const ImportDialog = dynamic(() => import("@/components/clients/import-dialog").then((m) => m.ImportDialog), { ssr: false });

const ClientActionsContext = createContext({ openAddClient: () => {}, openImport: () => {} });

/** `{ openAddClient, openImport }`. Safe outside the shell, where both do nothing. */
export const useClientActions = () => useContext(ClientActionsContext);

/**
 * @param {object[]} props.clientGroups existing clients
 * @param {() => void} props.onChanged called after clients were added, to refresh lists
 */
export function ClientActionsProvider({ clientGroups, onChanged, children }) {
  const [dialog, setDialog] = useState(null); // null | "add" | "import"
  // The dialogs are opened from buttons that are not their Radix triggers, so
  // remember what had focus and hand it back on close.
  const returnTo = useRef(null);
  const actions = useMemo(() => {
    const show = (which) => () => {
      returnTo.current = document.activeElement;
      setDialog(which);
    };
    return { openAddClient: show("add"), openImport: show("import") };
  }, []);
  const close = () => {
    setDialog(null);
    const target = returnTo.current;
    returnTo.current = null;
    // After Radix has released its focus trap.
    setTimeout(() => target?.isConnected && target.focus(), 0);
  };
  return (
    <ClientActionsContext.Provider value={actions}>
      {children}
      {dialog === "add" && (
        <AddClientDialog open onOpenChange={(o) => !o && close()} clientGroups={clientGroups} onCreated={onChanged} onImportInstead={() => setDialog("import")} />
      )}
      {dialog === "import" && <ImportDialog open onOpenChange={(o) => !o && close()} onImported={onChanged} />}
    </ClientActionsContext.Provider>
  );
}
