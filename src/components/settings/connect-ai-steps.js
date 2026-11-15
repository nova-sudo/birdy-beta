// Setup steps per AI app, as data so the wording is easy to edit.
// In a step, **bold** marks bold text and {url} becomes Birdy's MCP link.
// A step with `code` renders that line in a copyable-looking code block.

export const CONNECT_APPS = [
  {
    key: "claude",
    label: "Claude",
    steps: [
      { text: "In Claude, open **Settings → Connectors** and choose **Add custom connector**." },
      { text: "Name it **Birdy** and paste the link above." },
      { text: "Click **Connect**. You'll come back here to log in and choose what Claude can do." },
    ],
  },
  {
    key: "claude-desktop",
    label: "Claude Desktop",
    steps: [
      { text: "In Claude Desktop, open **Settings → Connectors** and choose **Add custom connector**." },
      { text: "Name it **Birdy** and paste the link above." },
      { text: "Click **Connect**. Your browser opens so you can log in to Birdy and choose what Claude can do." },
    ],
  },
  {
    key: "claude-code",
    label: "Claude Code",
    steps: [
      { text: "In your terminal, run:", code: "claude mcp add --transport http birdy {url}" },
      { text: "Start Claude Code and run **/mcp**, then pick **birdy** and choose **Authenticate**." },
      { text: "Log in to Birdy in the browser and choose what Claude Code can do." },
    ],
  },
  {
    key: "chatgpt",
    label: "ChatGPT",
    steps: [
      { text: "In ChatGPT, open **Settings → Connectors → Advanced** and turn on **Developer mode**." },
      { text: "Choose **Create**, name it **Birdy**, paste the link above and pick **OAuth** for authentication." },
      { text: "Click **Create**, then log in to Birdy and choose what ChatGPT can do." },
    ],
  },
  {
    key: "cursor",
    label: "Cursor",
    steps: [
      { text: "In Cursor, open **Settings → MCP** and choose **Add new MCP server**." },
      { text: "Name it **Birdy**, set the type to **HTTP** (streamable) and paste the link above." },
      { text: "Click **Login** next to Birdy, then log in and choose what Cursor can do." },
    ],
  },
]

export const CHECK_IN_PROMPT =
  "Every weekday at 8am, use Birdy's check_my_accounts tool and tell me only what needs my attention today, most urgent first."
