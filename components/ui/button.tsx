"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:h-4 [&_svg]:w-4",
  {
    variants: {
      variant: {
        default:   "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
        outline:   "border border-border bg-background text-foreground hover:bg-muted shadow-sm",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:     "text-foreground hover:bg-muted",
        destructive: "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/15",
        link:      "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4",
        xs:      "h-6 px-2 text-xs rounded-md",
        sm:      "h-7 px-3 text-xs rounded-md",
        lg:      "h-10 px-5",
        icon:    "h-9 w-9",
        "icon-sm":  "h-7 w-7 rounded-md",
        "icon-xs":  "h-6 w-6 rounded-md",
        "icon-lg":  "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function Button({
  className,
  variant,
  size,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
