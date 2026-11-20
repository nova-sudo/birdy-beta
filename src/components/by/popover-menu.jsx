"use client";

import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "./cn";

// A menu that opens from a trigger: arrow keys move, Enter picks, Escape
// closes. It is portalled to <body>, so it restates the body font and is never
// clipped by a scrolling parent.

export const Menu = MenuPrimitive.Root;

/** Wrap the element that opens the menu, e.g. `<MenuTrigger asChild><Button/></MenuTrigger>`. */
export const MenuTrigger = MenuPrimitive.Trigger;

export function MenuContent({ className, align = "start", sideOffset = 8, ...props }) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-48 origin-(--radix-dropdown-menu-content-transform-origin) rounded-by-lg bg-by-surface p-1.5 font-by-body text-by-body text-by-text shadow-by-floating outline-none",
          "motion-safe:animate-[by-menu_var(--by-dur-base)_var(--by-ease-spring)]",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

/** @param {boolean} [props.selected] marks the current choice in the accent colour */
export function MenuItem({ selected = false, className, ...props }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "flex h-9 cursor-pointer select-none items-center gap-2 rounded-by-md px-2.5 font-medium outline-none",
        "transition-colors duration-(--by-dur-fast) ease-by-out data-[highlighted]:bg-by-sunken",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
        selected && "bg-by-accent-soft text-by-accent data-[highlighted]:bg-by-accent-soft-hover",
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ className, ...props }) {
  return <MenuPrimitive.Label className={cn("px-2.5 pt-2 pb-1 text-by-caption font-semibold text-by-muted", className)} {...props} />;
}

export function MenuSeparator({ className, ...props }) {
  return <MenuPrimitive.Separator className={cn("mx-1 my-1.5 h-px bg-by-line", className)} {...props} />;
}
