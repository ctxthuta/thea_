"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"

import { cn } from "@/lib/utils"

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(
      "rounded-2xl border border-white/10 bg-[#181816]/60 backdrop-blur-md mb-3.5 overflow-hidden transition-all duration-200 data-[state=open]:border-[#5F1F2F]/70 data-[state=open]:bg-[#181816]/90 data-[state=open]:shadow-[0_8px_24px_-4px_rgba(95,31,47,0.2)]",
      className
    )}
    {...props}
  />
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between p-5 sm:p-6 font-ds-display text-base sm:text-lg font-semibold text-white transition-all text-left hover:text-[#f3a6b7] [&[data-state=open]>svg]:rotate-180 [&[data-state=open]>svg]:text-[#f3a6b7]",
        className
      )}
      {...props}
    >
      <span className="flex-1 pr-4">{children}</span>
      <svg
        className="h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down will-change-[height]"
    {...props}
  >
    <div className={cn("px-5 sm:px-6 pb-6 pt-0 text-sm sm:text-base leading-relaxed text-[#F1F1F0]/75 font-light", className)}>
      {children}
    </div>
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
