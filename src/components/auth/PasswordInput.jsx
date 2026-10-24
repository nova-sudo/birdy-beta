"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Input } from "@/components/ds"

/** ds Input at 48px with a show/hide toggle. Other props go to the input. */
export default function PasswordInput({ className, ...props }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <Input
        type={shown ? "text" : "password"}
        className={`h-control-lg pr-11 text-base ${className ?? ""}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShown(!shown)}
        aria-label={shown ? "Hide" : "Show"}
        className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer border-0 p-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
