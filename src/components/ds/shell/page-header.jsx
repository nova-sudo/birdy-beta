"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "../primitives/button"
import { Skeleton } from "../surfaces/skeleton"

/**
 * @typedef {object} PageHeaderBackButton
 * @property {string} label
 * @property {string} [href]
 * @property {() => void} [onClick] Takes precedence over `href`, for navigations that need a guard.
 */

function BackLink({ backButton }) {
  const router = useRouter()
  const asLink = !!backButton.href && !backButton.onClick
  const content = (
    <>
      <ArrowLeft />
      {backButton.label}
    </>
  )

  return (
    <Button
      asChild={asLink}
      variant="ghost"
      size="sm"
      className="-ml-2.5 w-fit text-muted-foreground"
      onClick={asLink ? undefined : (backButton.onClick ?? (() => router.back()))}
    >
      {asLink ? <Link href={backButton.href}>{content}</Link> : content}
    </Button>
  )
}

/**
 * The one page header: an optional back link, then the title (32/600, 26 on a phone) over a 16
 * muted description, with the page's period and actions on the right, bottom aligned. On a phone
 * the actions go full width and share the row.
 *
 * @param {object} props
 * @param {React.ReactNode} [props.title]
 * @param {React.ReactNode} [props.titleExtra] Beside the title, e.g. a status badge
 * @param {React.ReactNode} [props.eyebrow] Above the title
 * @param {React.ReactNode} [props.description]
 * @param {React.ReactNode} [props.actions]
 * @param {React.ReactNode} [props.period] Period / date-range control, shown first in the actions row
 * @param {boolean} [props.isLoading=false]
 * @param {PageHeaderBackButton} [props.backButton]
 * @param {React.ReactNode} [props.leading] Before the title, centred on it
 * @param {{ src: string, alt: string, className?: string }} [props.image] 72 r-frame image, md and up
 * @param {"left"|"center"} [props.align="left"]
 */
function PageHeader({
  title,
  titleExtra,
  eyebrow,
  description,
  actions,
  period,
  isLoading = false,
  backButton,
  leading,
  image,
  align = "left",
  className,
}) {
  const centered = align === "center"

  return (
    <header
      data-ds="page-header"
      data-slot="page-header"
      className={cn("mb-3 flex flex-col gap-3 font-sans", centered && "items-center text-center", className)}
    >
      {backButton && <BackLink backButton={backButton} />}

      <div
        className={cn(
          "flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:gap-6",
          centered && "items-center md:flex-col md:items-center md:gap-4"
        )}
      >
        <div className={cn("flex min-w-0 flex-1 items-center gap-4 md:basis-60", centered && "flex-col")}>
          {leading && <div className="flex shrink-0 items-center">{leading}</div>}
          {image &&
            (isLoading ? (
              <Skeleton className="hidden size-18 shrink-0 rounded-frame md:block" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image.src}
                alt={image.alt}
                width={72}
                height={72}
                className={cn("hidden size-18 shrink-0 rounded-frame object-cover md:block", image.className)}
              />
            ))}

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {isLoading ? (
              <>
                <Skeleton className={cn("h-8 w-48", centered && "mx-auto")} />
                <Skeleton className={cn("h-4 w-64", centered && "mx-auto")} />
              </>
            ) : (
              <>
                {eyebrow && <div className="mb-0.5 text-xs font-medium text-muted-foreground">{eyebrow}</div>}
                {title && (
                  <div className={cn("flex min-w-0 items-center gap-2.5", centered && "justify-center")}>
                    <h1 className="min-w-0 text-[26px] leading-8 font-semibold tracking-[-0.02em] text-balance text-foreground md:text-[32px] md:leading-9">
                      {title}
                    </h1>
                    {titleExtra}
                  </div>
                )}
                {description && <div className="text-sm text-muted-foreground md:text-base">{description}</div>}
              </>
            )}
          </div>
        </div>

        {(period || actions) && (
          // No shrink-0 (Bytes has it): with it the row overflowed 390px instead of wrapping.
          <div
            data-slot="page-header-actions"
            className={cn(
              "flex max-w-full flex-wrap items-center gap-2 max-md:w-full max-md:*:flex-1 md:ml-auto md:justify-end",
              isLoading && "pointer-events-none opacity-50"
            )}
          >
            {period}
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}

export { PageHeader }
