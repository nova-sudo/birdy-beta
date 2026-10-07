import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function StatsCard({ title, value, icon: Icon, subtitle, loading }) {
  return (
    <Card className="border shadow-sm rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-normal text-pd-muted text-muted-foreground">
          {title}
        </CardTitle>
        {Icon && (
          <div className="w-8 h-7 bg-pd-primary/10 rounded-md text-center flex items-center justify-center">
            <Icon className="h-4 w-5 text-purple-600" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="w-full py-4">
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {subtitle && (
          <p className="text-xs text-pd-muted text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )
}
