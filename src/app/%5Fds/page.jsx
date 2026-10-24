import { notFound } from "next/navigation"
import Showcase from "./showcase"

// Dev-only gallery of the ds kit. `%5F` is Next's escape for a leading underscore,
// which would otherwise make the folder private rather than routable at /_ds.
export const metadata = { title: "Design system" }

export default function DsPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <Showcase />
}
