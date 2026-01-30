'use client';

import Image from "next/image"
import { Eye, ChevronDown } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function ColumnVisibilityDropdown({
  isOpen,
  setIsOpen,

  categories,
  selectedCategory,
  setSelectedCategory,
  categoryCounts,

  searchTerm,
  setSearchTerm,

  filteredColumns,
  columnVisibility,
  toggleColumnVisibility,

  getIcon,

  selectAll,
  clearAll,
  save,
}) {
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-1 md:gap-2 px-2 md:px-4 font-semibold bg-white h-10 text-sm md:text-base"
        >
          <Eye className="h-4 w-4" />
          <span className="hidden lg:inline">Columns</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="bg-white p-0 w-screen sm:w-fit md:w-fit">
        {/* Categories */}
        <div className="flex flex-nowrap sm:flex-wrap gap-1 p-2 border-b overflow-x-auto md:overflow-x-visible">
          {categories.map(({ id, label }) => (
            <Button
              key={id}
              variant={selectedCategory === id ? "default" : "secondary"}
              size="sm"
              onClick={() => setSelectedCategory(id)}
              data-state={selectedCategory === id ? "active" : "inactive"}
              className="flex-shrink-0 text-[#71658B] font-semibold hover:bg-[#FBFAFE]
                data-[state=active]:bg-purple-100/50
                data-[state=active]:text-foreground
                data-[state=active]:border-b-3
                data-[state=active]:border-b-purple-700"
            >
              {label} {categoryCounts[id] || 0}
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="px-2 mt-2 mb-2">
          <Input
            className="w-full"
            placeholder={`Search in ${
              categories.find(c => c.id === selectedCategory)?.label ||
              "All Metrics"
            }...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Columns */}
        <div className="max-h-80 overflow-y-auto px-2 pb-2 border-t">
          {filteredColumns.map((col) => {
            const Icon = getIcon?.(col)

            return (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={columnVisibility[col.id] ?? col.visible}
                onCheckedChange={() => toggleColumnVisibility(col.id)}
                onSelect={(e) => e.preventDefault()}
              >
                {col.label}

                {Icon && (
                  <Image
                    src={Icon || "/placeholder.svg"}
                    alt=""
                    width={16}
                    height={16}
                    className="ml-auto opacity-70"
                  />
                )}
              </DropdownMenuCheckboxItem>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex p-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="border border-gray-300 rounded-md mr-2"
          >
            Select All
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="border border-gray-300 rounded-md mr-2"
          >
            Clear
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={save}
            className="rounded-md bg-purple-600 text-white font-semibold"
          >
            Save view
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
