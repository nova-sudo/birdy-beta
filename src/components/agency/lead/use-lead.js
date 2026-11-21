"use client";

// Everything the lead view reads, with the same calls and the same rules as the
// lead page always had:
//
// - GET /api/leads/contact/{id}: the lead. 404 means it is no longer in Birdy,
//   which gets its own message, since retrying will not bring it back.
// - GET .../messages: the GoHighLevel messages (and calls made in GoHighLevel),
//   fetched live once the lead has loaded. Slow and able to fail on its own, so
//   it has its own status and never blocks the page.
// - GET .../journey: on the first open of the Journey tab, then kept.
// - GET .../summary (POST to regenerate): see use-lead-summary.js.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { withGhlCalls } from "@/lib/lead-detail";
import { threadItems } from "@/lib/lead-view";

const base = (contactId) => `/api/leads/contact/${encodeURIComponent(contactId)}`;

export function useLead(contactId) {
  const [detail, setDetail] = useState(null);
  // "loading" | "ready" | "not-found" | "error"
  const [state, setState] = useState("loading");
  const [error, setError] = useState(null);

  const [messages, setMessages] = useState([]);
  const [ghlCalls, setGhlCalls] = useState([]);
  // "loading" | "ok" | "reconnect" | "unavailable"
  const [messagesStatus, setMessagesStatus] = useState("loading");
  const [messagesNote, setMessagesNote] = useState(null);
  // Only the newest request may write; a slow earlier one is dropped.
  const messagesReq = useRef(0);

  const loadMessages = useCallback(async () => {
    const id = ++messagesReq.current;
    setMessagesStatus("loading");
    setMessages([]);
    // GHL calls stay until the new answer lands, so a playing card isn't torn down.
    setMessagesNote(null);
    try {
      const res = await apiRequest(`${base(contactId)}/messages`);
      if (!res.ok) throw new Error(`The messages request failed (${res.status}).`);
      const data = await res.json();
      if (id !== messagesReq.current) return;
      setMessages(data.messages || []);
      setGhlCalls(data.calls || []);
      setMessagesNote(data.partial ? "Some messages couldn't be loaded." : data.truncated ? "Showing the most recent messages." : null);
      setMessagesStatus(data.status || "unavailable");
    } catch {
      if (id !== messagesReq.current) return;
      setMessages([]);
      setMessagesStatus("unavailable");
    }
  }, [contactId]);

  const [journey, setJourney] = useState(null);
  // "idle" | "loading" | "ready" | "error"
  const [journeyStatus, setJourneyStatus] = useState("idle");
  const journeyReq = useRef(0);
  const journeyStarted = useRef(false);

  const fetchJourney = useCallback(async () => {
    const id = ++journeyReq.current;
    journeyStarted.current = true;
    setJourneyStatus("loading");
    try {
      const res = await apiRequest(`${base(contactId)}/journey`);
      if (!res.ok) throw new Error(`The journey request failed (${res.status}).`);
      const data = await res.json();
      if (id !== journeyReq.current) return;
      setJourney(data);
      setJourneyStatus("ready");
    } catch {
      if (id !== journeyReq.current) return;
      setJourneyStatus("error");
    }
  }, [contactId]);

  const openJourney = useCallback(() => {
    if (!journeyStarted.current) fetchJourney();
  }, [fetchJourney]);

  useEffect(() => {
    // A different lead starts over.
    journeyReq.current += 1;
    journeyStarted.current = false;
    setGhlCalls([]);
    setJourney(null);
    setJourneyStatus("idle");
  }, [contactId]);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const res = await apiRequest(base(contactId));
      if (res.status === 404) {
        setState("not-found");
        return;
      }
      if (!res.ok) throw new Error(`The lead request failed (${res.status}).`);
      setDetail(await res.json());
      setState("ready");
      loadMessages();
    } catch (err) {
      if (err?.status === 404) {
        setState("not-found");
        return;
      }
      setError(err?.message || "The request failed.");
      setState("error");
    }
  }, [contactId, loadMessages]);

  useEffect(() => {
    load();
  }, [load]);

  // The lead with its GHL calls folded into calls and the engagement counts.
  const lead = useMemo(() => (detail ? withGhlCalls(detail, ghlCalls, contactId) : null), [detail, ghlCalls, contactId]);
  const items = useMemo(() => threadItems(lead?.calls, messages), [lead, messages]);

  const addMessage = useCallback((message) => message && setMessages((prev) => [...prev, message]), []);

  return {
    state, error, retry: load,
    lead, items, messagesStatus, messagesNote, reloadMessages: loadMessages, addMessage,
    journey, journeyStatus: journeyStatus === "idle" ? "loading" : journeyStatus, openJourney, retryJourney: fetchJourney,
  };
}
