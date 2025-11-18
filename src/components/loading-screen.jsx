import { Loader2, Database, Users, TrendingUp, FileText } from "lucide-react"


export function LoadingScreen({
  type = "default",
  title = "Loading",
  description = "Please wait while we fetch your data...",
  fullScreen = true,
}) {
  const configs = {
    contacts: {
      icon: Users,
      title: "Loading Contacts",
      description: "Fetching your contact information...",
      color: "from-blue-500 to-blue-600",
    },
    leads: {
      icon: TrendingUp,
      title: "Loading Leads",
      description: "Gathering lead data...",
      color: "from-green-500 to-green-600",
    },
    campaigns: {
      icon: FileText,
      title: "Loading Campaigns",
      description: "Retrieving campaign analytics...",
      color: "from-purple-500 to-purple-600",
    },
    groups: {
      icon: Database,
      title: "Loading Groups",
      description: "Fetching group information...",
      color: "from-orange-500 to-orange-600",
    },
    default: {
      icon: Database,
      title: "Loading Data",
      description: "Please wait...",
      color: "from-slate-500 to-slate-600",
    },
  }

  const config = configs[type] || configs.default
  const IconComponent = config.icon

  const containerClass = fullScreen
    ? "min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50"
    : "flex items-center justify-center py-12"

  return (
    <div className={containerClass}>
      <div className="flex flex-col items-center space-y-6 max-w-md">
        {/* Animated Icon Container */}
        <div className={`relative w-20 h-20 rounded-full bg-gradient-to-br ${config.color} p-0.5 shadow-lg`}>
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
            <div className="relative">
              {/* Rotating ring */}
              <div
                className="absolute inset-0 rounded-full border-4 border-transparent border-t-current border-r-current animate-spin"
                style={{ color: config.color.split(" ")[1] }}
              />

              {/* Icon */}
              <IconComponent className="w-10 h-10 text-current" style={{ color: config.color.split(" ")[1] }} />
            </div>
          </div>
        </div>

        {/* Text Content */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">{title || config.title}</h2>
          <p className="text-sm text-muted-foreground">{description || config.description}</p>
        </div>

        {/* Animated Dots */}
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0s" }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.2s" }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.4s" }} />
        </div>
      </div>
    </div>
  )
}

export function LoadingSkeletonTable({ rows = 5, columns = 4 }) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-muted/50">
                {Array.from({ length: columns }).map((_, colIdx) => (
                  <td key={colIdx} className="px-4 py-3">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function LoadingInline({ size = "md", text = "Loading..." }) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  }

  return (
    <div className="flex items-center gap-2">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-primary`} />
      <span className="text-sm text-muted-foreground">{text}</span>
    </div>
  )
}
