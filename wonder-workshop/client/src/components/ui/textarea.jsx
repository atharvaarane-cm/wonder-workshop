"use client";;
import { Field as FieldPrimitive } from "@base-ui/react/field";
import { mergeProps } from "@base-ui/react/merge-props";
import { cn } from "@/lib/utils";

export function Textarea(
  {
    className,
    size = "default",
    unstyled = false,
    ref,
    ...props
  }
) {
  return (
    <span
      className={
        cn(!unstyled &&
          "relative inline-flex w-full rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] has-focus-visible:has-aria-invalid:border-destructive/64 has-focus-visible:has-aria-invalid:ring-destructive/16 has-aria-invalid:border-destructive/36 has-focus-visible:border-ring has-disabled:opacity-64 has-[:disabled,:focus-visible,[aria-invalid]]:shadow-none has-focus-visible:ring-[3px] not-has-disabled:has-not-focus-visible:not-has-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] sm:text-sm dark:border-white/18 dark:bg-[#181818] dark:shadow-[0_1px_2px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.045)] dark:has-aria-invalid:ring-destructive/24", className) || undefined
      }
      data-size={size}
      data-slot="textarea-control">
      <FieldPrimitive.Control
        ref={ref}
        value={props.value}
        defaultValue={props.defaultValue}
        disabled={props.disabled}
        id={props.id}
        name={props.name}
        render={(defaultProps) => (
          <textarea
            className={cn(
              "field-sizing-content min-h-17.5 w-full rounded-[inherit] px-3 py-1.5 outline-none max-sm:min-h-20.5",
              size === "sm" &&
                "min-h-16.5 px-2.5 py-1 max-sm:min-h-19.5",
              size === "lg" &&
                "min-h-18.5 py-[calc(--spacing(2)-1px)] max-sm:min-h-21.5"
            )}
            data-slot="textarea"
            {...mergeProps(defaultProps, props)} />
        )} />
    </span>
  );
}

export { FieldPrimitive };
