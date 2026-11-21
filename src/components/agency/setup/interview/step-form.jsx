"use client";

import { ClientsForm, CplForm, PermissionsForm, ScheduleForm, SpeedForm } from "./forms-basic";
import { OutcomesForm, PlaybookForm, PracticeForm, SlackForm } from "./forms-remote";

const FORMS = {
  clients: ClientsForm,
  cpl: CplForm,
  playbook: PlaybookForm,
  permissions: PermissionsForm,
  schedule: ScheduleForm,
  slack: SlackForm,
  practice: PracticeForm,
  outcomes: OutcomesForm,
  speed: SpeedForm,
};

export const hasForm = (step) => Boolean(FORMS[step]);

/**
 * The form for one interview step.
 *
 * @param {string} props.step the step's name, as the reply's block `type` says
 * @param {object} [props.initial] the saved answer (`values[step]`), to edit it
 * @param {object} [props.data] what the reply's block carried (the playbook's rules)
 * @param {object} props.ctx {clients, watched, clientsLoading, currency, onSend}
 * @param {(body: object) => Promise<unknown>} props.onSubmit saves the answer; a throw shows its message
 */
export function StepForm({ step, ...props }) {
  const Form = FORMS[step];
  return Form ? <Form {...props} /> : null;
}
