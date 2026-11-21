"use client";

import { useState } from "react";
import { Button, DropdownTrigger, Menu, MenuContent, MenuItem, MenuTrigger, Notice, TextField } from "@/components/by";
import { CURRENCIES, basicsOf } from "@/lib/setup-steps";
import { Bubble, Lead, Reply } from "./chat-parts";

const QUICK = ["GBP", "USD", "EUR", "AUD"];

/** Agency basics: who they are, the agency's name, and the currency every figure is shown in. */
export function BasicsStep({ ctx }) {
  const { facts, steps, actions, agentName } = ctx;
  const known = basicsOf(facts.onboarding);
  const [name, setName] = useState(known.name);
  const [agency, setAgency] = useState(known.agency);
  const [currency, setCurrency] = useState(known.currency || "");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null);
  const done = steps.basics === "done";
  const first = (done ? known.name : name).split(" ")[0];

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setProblem(null);
    try {
      await actions.saveAnswers({ name: name.trim(), agency: agency.trim(), currency });
    } catch (err) {
      setProblem(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Bubble name={agentName} first id="step-basics">
        <p><Lead>Hi{first ? ` ${first}` : ""}, I’m Birdy.</Lead>Let’s get your agency set up: a few quick questions, then your tools. I suggest, you confirm.</p>
        {!done && (
          <form onSubmit={save} className="flex flex-col gap-3">
            <p>First, what should I call you, what’s your agency called, and which currency do you report in?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
              <TextField label="Agency name" value={agency} onChange={(e) => setAgency(e.target.value)} autoComplete="organization" />
            </div>
            <CurrencyPick value={currency} onChange={setCurrency} />
            {problem && <Notice tone="danger">{problem}</Notice>}
            <div><Button kind="primary" type="submit" loading={saving} disabled={!name.trim() || !agency.trim() || !currency}>Continue</Button></div>
          </form>
        )}
      </Bubble>
      {done && <Reply>{known.name} · {known.agency} · {known.currency}</Reply>}
    </>
  );
}

/** The four usual currencies as chips, the rest in a menu. */
function CurrencyPick({ value, onChange }) {
  const other = value && !QUICK.includes(value) ? CURRENCIES.find((c) => c.code === value) : null;
  return (
    <div role="radiogroup" aria-label="Currency" className="flex flex-wrap items-center gap-2">
      {QUICK.map((code) => (
        <Button key={code} role="radio" aria-checked={value === code} kind={value === code ? "soft" : "secondary"} className="rounded-full font-medium" onClick={() => onChange(code)}>
          {code}
        </Button>
      ))}
      <Menu>
        <MenuTrigger asChild>
          <DropdownTrigger aria-label="Other currency" className="rounded-full">
            {other ? other.code : "Other"}
          </DropdownTrigger>
        </MenuTrigger>
        <MenuContent>
          {CURRENCIES.filter((c) => !QUICK.includes(c.code)).map((c) => (
            <MenuItem key={c.code} selected={value === c.code} onSelect={() => onChange(c.code)}>{c.code} · {c.label}</MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </div>
  );
}
