"use client";

// Settings › Account: name, timezone and currency (GET/PATCH /api/user/profile),
// the password (POST /api/user/password), and the Slack report's schedule.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Disclosure, SelectField, Skeleton, TextField, UserAvatar } from "@/components/by";
import { apiRequest } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { CURRENCIES, TIMEZONES, withCurrent } from "@/lib/account-options";
import { SlackReport } from "./slack-report";

/** One label-and-field row: the label beside the field on a wide screen, above it on a phone. */
function Row({ label, htmlFor, children }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[10rem_minmax(0,22rem)] sm:items-center sm:gap-4">
      <label htmlFor={htmlFor} className="text-by-body-sm font-semibold text-by-text">{label}</label>
      {children}
    </div>
  );
}

function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (next !== confirm) {
      setError("The two new passwords do not match");
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("/api/user/password", { method: "POST", body: JSON.stringify({ current_password: current, new_password: next }) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Could not change password");
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password updated");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Row label="Current password" htmlFor="pw-current">
        <TextField id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Row>
      <Row label="New password" htmlFor="pw-new">
        <TextField id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} help="At least 8 characters, and different from your current one." />
      </Row>
      <Row label="Confirm new password" htmlFor="pw-confirm">
        <TextField id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={error || undefined} />
      </Row>
      <div className="sm:pl-[11rem]">
        <Button type="submit" kind="primary" loading={saving} disabled={!current || !next || !confirm}>{saving ? "Updating…" : "Update password"}</Button>
      </div>
    </form>
  );
}

function ProfileCard() {
  const [profile, setProfile] = useState(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("");
  const [timezone, setTimezone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/user/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (!data) return setFailed(true);
        setProfile(data);
        setName(data.name || "");
        setCurrency(data.default_currency || "USD");
        setTimezone(data.timezone || "");
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const reset = () => {
    setName(profile.name || "");
    setCurrency(profile.default_currency || "USD");
    setTimezone(profile.timezone || "");
  };
  const dirty = profile && (name !== (profile.name || "") || currency !== (profile.default_currency || "USD") || timezone !== (profile.timezone || ""));

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("/api/user/profile", { method: "PATCH", body: JSON.stringify({ name: name.trim(), default_currency: currency, timezone }) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setProfile((prev) => ({ ...prev, name: name.trim(), default_currency: currency, timezone }));
      setName(name.trim());
      // Pages that format money before the profile lands read this copy.
      try {
        localStorage.setItem(STORAGE_KEYS.DEFAULT_CURRENCY, currency);
      } catch {}
      toast.success("Settings saved");
    } catch {
      toast.error("Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padded className="flex flex-col gap-4">
      <h3 className="font-by-display text-by-body-lg font-bold">Account</h3>
      <div className="flex items-center gap-3.5 border-b border-by-line-soft pb-4">
        {profile ? <UserAvatar name={profile.name || profile.email} className="size-12 text-by-heading" /> : <Skeleton className="size-12 rounded-full" />}
        <div className="min-w-0">
          {profile ? (
            <>
              <div className="truncate font-by-display text-by-body-lg font-bold">{profile.name || profile.email}</div>
              <div className="truncate text-by-body-sm text-by-muted">{profile.email}</div>
            </>
          ) : failed ? (
            <p className="text-by-body-sm text-by-danger">Couldn’t load your account. Reload the page to try again.</p>
          ) : (
            <>
              <Skeleton className="w-32" />
              <Skeleton className="mt-2 w-48" />
            </>
          )}
        </div>
      </div>

      <form onSubmit={save} className="flex flex-col gap-3">
        <Row label="Name" htmlFor="acct-name">
          <TextField id="acct-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} disabled={!profile} />
        </Row>
        <Row label="Email" htmlFor="acct-email">
          {/* The account id is the email, so changing it would rekey every record. */}
          <TextField id="acct-email" value={profile?.email ?? ""} readOnly disabled help="Your email is your account identifier and cannot be changed here." />
        </Row>
        <Row label="Timezone" htmlFor="acct-tz">
          <SelectField id="acct-tz" value={timezone} onValueChange={setTimezone} options={withCurrent(TIMEZONES, timezone).map((tz) => ({ value: tz, label: tz }))} placeholder="Select a timezone" disabled={!profile} />
        </Row>
        <Row label="Currency" htmlFor="acct-cur">
          <SelectField id="acct-cur" value={currency} onValueChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c.code, label: c.label }))} placeholder="Select a currency" disabled={!profile} />
        </Row>
        <div className="flex gap-2 sm:pl-[11rem]">
          <Button type="submit" kind="primary" loading={saving} disabled={!dirty}>{saving ? "Saving…" : "Save changes"}</Button>
          <Button onClick={reset} disabled={!dirty || saving}>Cancel</Button>
        </div>
      </form>

      <Disclosure label="Change password">
        <PasswordForm />
      </Disclosure>
    </Card>
  );
}

export function AccountSection({ integrations }) {
  return (
    <>
      <ProfileCard />
      <SlackReport slack={integrations.slack} checking={integrations.checking} onSaved={(brief) => integrations.updateSlack({ brief })} />
    </>
  );
}
