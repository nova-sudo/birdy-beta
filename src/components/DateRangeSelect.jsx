import { DATE_PRESETS } from "@/lib/constants"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function DateRangeSelect({ value, onChange }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="flex items-center gap-1 md:gap-2 px-2 font-semibold md:px-4 bg-pd-surface h-10 text-sm rounded-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DATE_PRESETS.map((preset) => (
          <SelectItem key={preset.value} value={preset.value}>
            {preset.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
