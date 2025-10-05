// components/ui/slider.tsx
"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cn } from "@/lib/utils"

type RootProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>

function thumbCount(props: RootProps) {
  if (Array.isArray(props.value)) return props.value.length
  if (Array.isArray(props.defaultValue)) return props.defaultValue.length
  return 1
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  RootProps
>(({ className, ...props }, ref) => {
  const n = thumbCount(props)

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        "[--track-h:var(--track-h,6px)] [--thumb-s:var(--thumb-s,16px)]",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn(
          "relative h-[var(--track-h)] w-full grow overflow-hidden rounded-full",
          "bg-primary/20"
        )}
      >
        <SliderPrimitive.Range
          className={cn(
            "absolute h-full z-0",                 // keep the colored range under the thumbs
            "bg-primary bg-gradient-to-r from-violet-500/30 via-fuchsia-500/20 to-rose-500/30"
          )}
        />
      </SliderPrimitive.Track>

      {Array.from({ length: n }).map((_, i) => (
        <SliderPrimitive.Thumb
          key={i}
          className={cn(
            "relative z-30 block rounded-full",     // ⬅️ higher than ticks/overlay
            "h-[var(--thumb-s)] w-[var(--thumb-s)]",
            "border border-primary/50 bg-background shadow transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            "hover:ring-2 hover:ring-primary/30",
            "data-[state=active]:ring-2 data-[state=active]:ring-primary/60",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        />
      ))}
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
