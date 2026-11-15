"use client";
import * as React from "react";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { cn } from "@/lib/utils";
const Context = React.createContext<any>(null);
export function ChoiceGroup({
  value,
  defaultValue,
  onValueChange,
  disabled,
  name,
  required,
  children,
}: any) {
  const [local, setLocal] = React.useState(defaultValue || "");
  const id = React.useId();
  return (
    <Context.Provider
      value={{
        value: value ?? local,
        change: (v: string) => {
          setLocal(v);
          onValueChange?.(v);
        },
        disabled,
        name,
        required,
        id,
      }}
    >
      <div className="min-w-0 space-y-2">{children}</div>
    </Context.Provider>
  );
}
export const ChoiceTrigger = React.forwardRef<HTMLDivElement, any>(
  ({ children, className, ...props }, ref) => {
    const c = React.useContext(Context);
    return (
      <div
        {...props}
        ref={ref}
        id={c.id}
        className={cn("text-sm font-medium text-foreground", className)}
      >
        {children}
      </div>
    );
  },
);
ChoiceTrigger.displayName = "ChoiceTrigger";
export function ChoiceValue({ placeholder }: any) {
  return <span>{placeholder || "Choisir une option"}</span>;
}
export const ChoiceContent = React.forwardRef<HTMLDivElement, any>(
  (
    { children, className, position, align, side, forceMount, ...props },
    ref,
  ) => {
    const c = React.useContext(Context);
    const [search, setSearch] = React.useState("");
    return (
      <div className="space-y-2 min-w-0">
        <label className="block">
          <span className="sr-only">Rechercher dans les choix</span>
          <input
            type="search"
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border bg-background p-2 text-sm"
            disabled={c.disabled}
          />
        </label>
        <SearchContext.Provider value={search}>
          <RadioGroup
            {...props}
            ref={ref}
            value={String(c.value)}
            onValueChange={c.change}
            name={c.name}
            required={c.required}
            disabled={c.disabled}
            aria-labelledby={c.id}
            className={cn(
              "max-h-64 overflow-y-auto rounded-lg border p-2 gap-2",
              className,
            )}
          >
            {children}
          </RadioGroup>
        </SearchContext.Provider>
      </div>
    );
  },
);
ChoiceContent.displayName = "ChoiceContent";
const SearchContext = React.createContext("");
function text(node: React.ReactNode): string {
  return React.Children.toArray(node)
    .map((n: any) =>
      typeof n === "string" || typeof n === "number"
        ? String(n)
        : React.isValidElement(n)
          ? text((n.props as any).children)
          : "",
    )
    .join(" ");
}
export const ChoiceItem = React.forwardRef<HTMLLabelElement, any>(
  ({ value, disabled, children, className, ...props }, ref) => {
    const c = React.useContext(Context),
      search = React.useContext(SearchContext),
      id = React.useId();
    const hidden =
      search &&
      !text(children)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(
          search
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase(),
        );
    return (
      <label
        ref={ref}
        hidden={!!hidden}
        className={cn(
          "items-start gap-3 rounded-md border p-3 text-sm cursor-pointer",
          hidden ? "hidden" : "flex",
          className,
        )}
      >
        <RadioGroupItem
          id={id}
          value={String(value)}
          disabled={disabled || c.disabled}
          className="mt-0.5 shrink-0"
        />
        <span className="min-w-0 break-words">{children}</span>
      </label>
    );
  },
);
ChoiceItem.displayName = "ChoiceItem";
export const ChoiceSection = ({ children, ...props }: any) => (
  <div {...props} className="space-y-2">
    {children}
  </div>
);
export const ChoiceLabel = ({ children }: any) => (
  <p className="text-sm font-semibold">{children}</p>
);
export const ChoiceSeparator = () => <hr />;
export const ChoiceScrollUpButton = () => null;
export const ChoiceScrollDownButton = () => null;
/** Migration of native selects: preserve controlled value and change handlers, render radios only. */
export const NativeChoice = React.forwardRef<HTMLDivElement, any>(
  (
    {
      children,
      value,
      defaultValue,
      onChange,
      id,
      disabled,
      name,
      required,
      className,
      ...props
    }: any,
    ref,
  ) => {
    return (
      <ChoiceGroup
        value={value}
        defaultValue={defaultValue}
        onValueChange={(v: string) =>
          onChange?.({ target: { value: v }, currentTarget: { value: v } })
        }
        disabled={disabled}
        name={name}
        required={required}
      >
        <ChoiceTrigger
          ref={ref}
          tabIndex={0}
          id={id}
          aria-label={props["aria-label"]}
        >
          <ChoiceValue
            placeholder={props["aria-label"] || "Choisir une option"}
          />
        </ChoiceTrigger>
        <ChoiceContent>{children}</ChoiceContent>
      </ChoiceGroup>
    );
  },
);
NativeChoice.displayName = "NativeChoice";
export function NativeOption({ value, children, disabled }: any) {
  return value === "" ? (
    <p className="text-sm text-muted-foreground">{children}</p>
  ) : (
    <ChoiceItem value={value ?? text(children)} disabled={disabled}>
      {children}
    </ChoiceItem>
  );
}
