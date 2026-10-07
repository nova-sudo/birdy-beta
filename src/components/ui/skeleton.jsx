import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton-shimmer rounded-xl", className)}
      {...props} />
  );
}

export { Skeleton }
