"use client";
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Slot } from "@radix-ui/react-slot";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { cn } from "@/lib/utils";
const Context = React.createContext<any>(null);
export function ActionPanel({ children, open, onOpenChange }: any) {
  const [local, setLocal] = React.useState(false);
  const set = (value: boolean) => { setLocal(value); onOpenChange?.(value); };
  return <Context.Provider value={{open: open ?? local, set}}>
    <PopoverPrimitive.Root open={open ?? local} onOpenChange={set}>
      {children}
    </PopoverPrimitive.Root>
  </Context.Provider>;
}
export const ActionPanelTrigger = PopoverPrimitive.Trigger;
export const ActionPanelContent = React.forwardRef<HTMLDivElement, any>(
  ({children, className, align = "end", sideOffset = 8, ...props}, ref) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content ref={ref} align={align} sideOffset={sideOffset}
        collisionPadding={12} {...props}
        className={cn("z-[60] flex flex-col gap-2 rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl outline-none max-w-[calc(100vw-24px)] max-h-[var(--radix-popover-content-available-height)] overflow-y-auto", className)}>
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
);
ActionPanelContent.displayName = "ActionPanelContent";
export const ActionPanelItem = React.forwardRef<HTMLButtonElement, any>(
  (
    {
      asChild,
      children,
      className,
      onClick,
      onSelect,
      inset,
      disabled,
      ...props
    },
    ref,
  ) => {
    const c = React.useContext(Context),
      Component = asChild ? Slot : "button";
    return (
      <Component
        {...props}
        ref={ref}
        type={asChild ? undefined : "button"}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-left focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
          className,
        )}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
          onSelect?.(e);
          if (!e.defaultPrevented) c.set(false);
        }}
      >
        {children}
      </Component>
    );
  },
);
ActionPanelItem.displayName = "ActionPanelItem";
export const ActionPanelGroup = ({ children }: any) => (
  <div className="flex flex-wrap gap-2">{children}</div>
);
export const ActionPanelLabel = ({ children, className }: any) => (
  <div className={cn("w-full text-sm font-semibold", className)}>
    {children}
  </div>
);
export const ActionPanelSeparator = () => <hr className="w-full" />;
export const ActionPanelShortcut = ({ children }: any) => (
  <span className="text-xs text-muted-foreground">{children}</span>
);
export const ActionPanelRadioGroup = RadioGroup;
export function ActionPanelRadioItem({ value, children, disabled }: any) {
  return (
    <label className="flex gap-2 p-2 items-center">
      <RadioGroupItem value={value} disabled={disabled} />
      {children}
    </label>
  );
}
export function ActionPanelCheckboxItem({
  checked,
  onCheckedChange,
  children,
  disabled,
}: any) {
  return (
    <label className="flex gap-2 p-2 items-center">
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
      />
      {children}
    </label>
  );
}
export const ActionPanelSub = ActionPanel;
export const ActionPanelSubTrigger = ActionPanelTrigger;
export const ActionPanelSubContent = ActionPanelContent;
export const ActionPanelPortal = ({ children }: any) => <>{children}</>;
