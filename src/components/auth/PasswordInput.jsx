"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ds"
import { cn } from "@/lib/utils"

/** ds Input at 48px with a show/hide toggle. Other props go to the input. */
export default function PasswordInput({ className, ...props }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <Input
        type={shown ? "text" : "password"}
        className={cn("h-control-lg pr-11 text-base", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-control border-0 p-1 text-muted-foreground outline-none transition-[color,box-shadow] hover:text-foreground focus-visible:shadow-control-focus"
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
