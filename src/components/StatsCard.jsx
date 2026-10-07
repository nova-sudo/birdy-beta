import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function StatsCard({ title, value, icon: Icon, subtitle, loading }) {
  return (
    <Card className="border border-pd-border bg-pd-surface shadow-sm rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-pd-subtle">
          {title}
        </CardTitle>
        {Icon && (
          <div className="size-8 bg-pd-primary-tint rounded-full text-center flex items-center justify-center">
            <Icon className="size-4 text-pd-primary" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="w-full py-4">
            <Skeleton className="h-6 w-1/2 rounded-full" />
          </div>
        ) : (
          <div className="font-pd-display text-2xl font-bold text-pd-ink">{value}</div>
        )}
        {subtitle && (
          <p className="text-xs text-pd-subtle">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}
