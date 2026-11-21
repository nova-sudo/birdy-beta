"use client";

// Sends one SMS or email to the lead: POST /api/leads/contact/{id}/messages.
// This is a real message to a real person, so the flow is the old page's, unchanged:
// - Only an explicit Send (the button, or Enter in an SMS) sends. Nothing sends on its own.
// - The button doubles as the in-flight guard: disabled from the click until the answer,
//   and a ref blocks a second submit before the re-render, so a double click is one request.
// - On any failure the draft stays and the backend's `detail` is shown under the box,
//   except a 504 (outcome unknown): the draft is cleared, so a second click can't
//   double-send, and onUnconfirmed re-reads the thread.

import { useLayoutEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { Segmented, cn } from "@/components/by";
import { apiRequest } from "@/lib/api";

export const COMPOSER_INPUT_ID = "lead-composer-input";

const CHANNELS = [{ value: "SMS", label: "SMS" }, { value: "Email", label: "Email" }];

// FastAPI sends `detail` as a string, or as a list of {msg} for a 422.
function errorDetail(detail) {
  if (typeof detail === "string" && detail) return detail;
  const first = Array.isArray(detail) ? detail[0]?.msg : null;
  return typeof first === "string" && first ? first : "Couldn't send the message.";
}

/** Why Send is off, or null when it can send. */
export function sendBlocker({ status, channel, contact, subject, body }) {
  if (status !== "ok") {
    return status === "reconnect" ? "Reconnect GoHighLevel to send messages."
      : status === "unavailable" ? "Messaging isn't available right now."
      : "Waiting for messages to load.";
  }
  if (channel === "Email") {
    if (!contact?.email) return "No email address";
    return subject.trim() === "" && body.trim() !== "" ? "Add a subject" : null;
  }
  return contact?.phone ? null : "No phone number";
}

export function LeadComposer({ contact, contactId, status, onSent, onUnconfirmed }) {
  const [channel, setChannel] = useState("SMS");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  // Set synchronously so a second submit can never start before the re-render.
  const inFlight = useRef(false);
  const box = useRef(null);

  const isEmail = channel === "Email";
  const hasBody = body.trim() !== "" && (!isEmail || subject.trim() !== "");
  const reason = sendBlocker({ status, channel, contact, subject, body });
  const canSend = !reason && hasBody && !sending;

  // The box grows with the draft up to 160px, then scrolls.
  useLayoutEffect(() => {
    const t = box.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
  }, [body, channel]);

  const send = async () => {
    if (!canSend || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setError(null);
    try {
      const payload = { channel, message: body.trim() };
      if (isEmail) payload.subject = subject.trim();
      const res = await apiRequest(`/api/leads/contact/${encodeURIComponent(contactId ?? contact.id)}/messages`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorDetail(data?.detail));
        if (res.status === 504) {
          // Outcome unknown: the message may have been delivered. Drop the draft
          // so a second click can't double-send, and re-read the thread.
          setBody("");
          setSubject("");
          onUnconfirmed?.();
        }
        return;
      }
      onSent?.(data.message);
      setBody("");
      setSubject("");
    } catch (err) {
      setError(err?.message || "The message couldn't be sent.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    // Enter that confirms an IME candidate is not a send.
    if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
    if (e.key === "Enter" && !e.shiftKey && !isEmail) {
      e.preventDefault();
      send();
    }
  };

  const to = isEmail ? contact?.email : contact?.phone;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="group/composer shrink-0 px-3.5 pb-3 pt-1.5"
    >
      <div className="flex items-end gap-2.5 rounded-by-lg border border-by-line bg-by-surface p-1.5 shadow-by-raised transition-colors duration-(--by-dur-fast) focus-within:border-by-accent">
        <Segmented aria-label="Channel" items={CHANNELS} value={channel} onValueChange={setChannel} className="mb-px" />
        <div className="flex min-w-0 flex-1 flex-col">
          {isEmail && (
            <input
              aria-label="Subject"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="border-b border-by-line-soft bg-transparent px-1 py-1.5 font-by-body text-by-body font-semibold text-by-text outline-none placeholder:font-normal placeholder:text-by-muted"
            />
          )}
          <textarea
            ref={box}
            id={COMPOSER_INPUT_ID}
            rows={isEmail ? 3 : 1}
            placeholder={isEmail ? "Write an email…" : "Write a text…"}
            aria-label="Message"
            aria-describedby={to ? "lead-composer-to" : undefined}
            value={body}
            maxLength={1600}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            className="max-h-40 min-h-8 resize-none bg-transparent px-1 py-1.5 font-by-body text-by-body leading-[1.4] text-by-text caret-by-accent outline-none placeholder:text-by-muted"
          />
        </div>
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          aria-busy={sending || undefined}
          className={cn(
            "grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-by-accent text-by-on-accent transition-opacity duration-(--by-dur-fast)",
            "hover:bg-by-accent-hover disabled:cursor-not-allowed disabled:opacity-40",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-by-accent",
          )}
        >
          <SendHorizontal aria-hidden="true" className="size-3.5" />
        </button>
      </div>
      {to && (
        <div className="flex items-center justify-between gap-3 px-1.5 pt-1.5 text-by-caption text-by-muted">
          <span id="lead-composer-to" className="min-w-0 truncate">To: <span className="text-by-text-2 tabular-nums">{to}</span></span>
          <span className="hidden whitespace-nowrap opacity-0 transition-opacity group-focus-within/composer:opacity-100 sm:inline">
            {isEmail ? "Enter for a new line" : "Enter to send · Shift+Enter for a new line"}
          </span>
        </div>
      )}
      {reason && <p className="px-1.5 pt-1 text-by-caption text-by-text-2">{reason}</p>}
      {error && <p role="alert" className="px-1.5 pt-1 text-by-caption text-by-danger">{error}</p>}
    </form>
  );
}
