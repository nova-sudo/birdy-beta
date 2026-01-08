import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"

/**
 * Reusable container for dashboard tables with glassmorphism styling
 */
export const TableContainer = ({ children, title, description }) => (
  <Card className="border border-border/40 shadow-sm hover:shadow-md transition-shadow bg-white/50 backdrop-blur-sm">
    <CardHeader className="pb-3 border-b border-border/30">
      <div>
        <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
        {description && <CardDescription className="text-xs text-muted-foreground mt-1">{description}</CardDescription>}
      </div>
    </CardHeader>
    <CardContent className="p-0 overflow-x-auto">{children}</CardContent>
  </Card>
)

/**
 * StyledTable component that uses shadcn UI table components
 */
const StyledTable = ({ columns, data }) => (
  <Table className="w-full text-sm">
    <TableHeader className="bg-muted/30">
      <TableRow className="hover:bg-transparent">
        {columns.map((col) => (
          <TableHead
            key={col.key}
            className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide"
          >
            {col.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {data?.length > 0 ? (
        data.map((row, idx) => (
          <TableRow key={idx} className="hover:bg-muted/30 transition-colors border-border/10">
            {columns.map((col) => (
              <TableCell key={col.key} className="px-4 py-3 text-foreground/80">
                {col.render ? col.render(row[col.key], row) : row[col.key]}
              </TableCell>
            ))}
          </TableRow>
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground italic">
            No data available for this audit.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
)

export default StyledTable
