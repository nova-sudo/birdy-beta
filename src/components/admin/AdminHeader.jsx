import { cn } from "@/lib/utils"

/**
 * Page heading for the admin console. The shell's top bar already owns the h1
 * ("Admin"), so pages head their content with an h2 at the console's quieter
 * 20px size instead of the full ds PageHeader.
 *
 * @param {object} props
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.description]
 * @param {React.ReactNode} [props.actions] Right-aligned controls (wraps under the title on narrow screens)
 */
export default function AdminHeader({ title, description, actions, className }) {
  return (
    <div
      data-ds="admin-header"
      className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3 font-sans", className)}
    >
      <div className="min-w-0">
        <h2 className="text-xl font-semibold leading-tight text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
