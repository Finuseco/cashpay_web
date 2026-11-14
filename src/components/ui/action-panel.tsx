"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { cn } from "@/lib/utils";
const Context = React.createContext<any>(null);
export function ActionPanel({ children, open, onOpenChange }: any) {
  const [local, setLocal] = React.useState(false);
  const id = React.useId();
  return (
    <Context.Provider
      value={{
        open: open ?? local,
        set: (v: boolean) => {
          setLocal(v);
          onOpenChange?.(v);
        },
        id,
      }}
    >
      <div className="inline-flex max-w-full flex-col items-stretch">
        {children}
      </div>
    </Context.Provider>
  );
}
export const ActionPanelTrigger = React.forwardRef<HTMLButtonElement, any>(
  ({ asChild, children, onClick, ...props }, ref) => {
    const c = React.useContext(Context),
      Component = asChild ? Slot : "button";
    return (
      <Component
        {...props}
        ref={ref}
        type="button"
        aria-expanded={c.open}
        aria-controls={c.id}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented) c.set(!c.open);
        }}
      >
        {children}
      </Component>
    );
  },
);
ActionPanelTrigger.displayName = "ActionPanelTrigger";
export const ActionPanelContent = React.forwardRef<HTMLDivElement, any>(
  (
    {
      children,
      className,
      align,
      side,
      sideOffset,
      forceMount,
      onCloseAutoFocus,
      ...props
    },
    ref,
  ) => {
    const c = React.useContext(Context);
    return c.open ? (
      <div
        {...props}
        ref={ref}
        id={c.id}
        role="group"
        aria-label="Actions disponibles"
        className={cn(
          "flex max-w-full flex-wrap gap-2 rounded-xl border bg-card p-3 text-card-foreground my-2",
          className,
        )}
        onKeyDown={(e) => {
          if (e.key === "Escape") c.set(false);
        }}
      >
        {children}
      </div>
    ) : null;
  },
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
