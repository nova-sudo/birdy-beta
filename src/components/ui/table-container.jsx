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
const StyledTable = ({ columns = [], data = [] }) => (
  <>
  <Table className="w-full text-sm">
    <TableHeader className="bg-muted/30">
      <TableRow className="hover:bg-transparent">
        {columns.map((col, colIdx) => (
          <TableHead
            key={col.key}
            className={`px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase border border-2 border-l-0 border-t-0 border-b-0
             tracking-wide ${colIdx === 0 ? 'fixed-header' : 'min-w-[135px]  whitespace-nowrap '}`}>
            {col.header ? col.header() : col.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>

    <TableBody>
      {data.length > 0 ? (
        data.map((row, idx) => (
          <TableRow key={idx} className={`hover:bg-muted/30 transition-colors border-b border-border/10 
          ${idx % 2 === 0 ? 'bg-[#F4F3F9]' : 'bg-white'}`}>
            {columns.map((col, colIdx) => (
              <TableCell key={col.key} className={`px-4 py-3 text-foreground/80 
              ${colIdx === 0 ? (idx % 2 === 0 ? 'bg-[#F4F3F9]' : 'bg-white') : ''}`}>
                {col.render ? col.render(row[col.key], row) : row[col.key]}
              </TableCell>
            ))}
          </TableRow>
        ))
      ) : (
        <TableRow>
          <TableCell colSpan={columns.length || 1} className="h-24 text-center text-muted-foreground italic">
            No data available.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
  <style jsx>{`
        @media (min-width: 768px) {
          .fixed-column-even {
            text-align: left;
            position: sticky;
            left: 0;
            background: white;
            z-index: 50;
            min-width: 243px;
            font-weight: 600;
          }
          .fixed-column-odd {
            text-align: left;
            position: sticky;
            left: 0;
            background: #f4f3f9;
            z-index: 50;
            min-width: 243px;
            font-weight: 600;
          }
          .fixed-header {
            position: sticky;
            left: 0;
            z-index: 50;
            background: white;
            min-width: 150px;
            width: 100%;
          }
        }

        @media (max-width: 767px) {
          .fixed-column-even,
          .fixed-column-odd {
            text-align: left;
            background: white;
            min-width: 200px;
            font-weight: 600;
          }
          .fixed-column-odd {
            background: #f4f3f9;
          }
          .fixed-header {
            background: white;
            min-width: 150px;
            width: 100%;
          }
        }

        .table-container {
          position: relative;
          overflow: auto;
        }
      `}</style>
  </>
)


export default StyledTable