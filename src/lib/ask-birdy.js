// Opening the Birdy assistant from anywhere in the app.
//
// The chat modal is owned by src/app/layout.jsx, which sits above every page in
// the tree and holds its open state. Pages have no way to reach it — the header
// form is the only thing that ever opened it. Rather than thread a context down
// through every route for one button, a page announces what it wants asked and
// the layout, which is already listening, opens the modal seeded with it.
//
// A DOM event rather than a context because the two ends are in different parts
// of the tree and neither renders the other: the layout owns the modal, the page
// owns the question, and nothing in between needs to know either exists.

export const ASK_BIRDY_EVENT = "birdy:ask";

/** Open the assistant with a question already in the box. */
export function askBirdy(message) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ASK_BIRDY_EVENT, { detail: { message } }));
}
