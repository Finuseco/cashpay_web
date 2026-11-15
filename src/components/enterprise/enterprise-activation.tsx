"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2 } from "lucide-react";
export function EnterpriseActivation({
  companyId,
  onSaved,
}: {
  companyId: number;
  onSaved?: (name: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [manager, setManager] = useState(""),
    [currency, setCurrency] = useState("USD"),
    [quote, setQuote] = useState<any>(null),
    [pin, setPin] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [accepted, setAccepted] = useState(false);
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    setQuote(null);
    setError("");
    setAccepted(false);
    fetch(
      `/api/v1/admin/enterprise?companyId=${companyId}&currency=${currency}`,
      { cache: "no-store", signal: abort.signal },
    )
      .then((r) => r.json())
      .then((data) => {
        if (abort.signal.aborted) return;
        if (!data.success) throw Error(data.error);
        setQuote(data);
        setName((old) => old || data.companyName);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [open, companyId, currency]);
  async function activate(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !quote || !accepted) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/admin/enterprise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          companyName: name,
          managerWallet: manager || undefined,
          monthlyCurrency: currency,
          acceptedMonthlyAmount: quote.monthlyAmount,
          pin,
          active: true,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw Error(data.error);
      setOpen(false);
      onSaved?.(name);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPin("");
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setName("");
          setOpen(true);
        }}
      >
        <Building2 className="mr-2 h-4 w-4" />
        Compte entreprise et salaires
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) {
            setOpen(value);
            setPin("");
          }
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Activer le compte entreprise</DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            L’ID Wallet et le compte existant sont conservés. Le nom affiché
            devient celui de l’entreprise. Cette activation ne donne pas de
            nouvelles clés API.
          </p>
          <form onSubmit={activate} className="space-y-4">
            <label className="grid gap-2">
              Nom de l’entreprise
              <Input
                required
                minLength={2}
                maxLength={160}
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="grid gap-2">
              Wallet personnel du gérant (facultatif)
              <Input
                value={manager}
                disabled={busy}
                onChange={(e) => setManager(e.target.value)}
              />
              <span className="text-xs text-muted-foreground">
                Sans délégation, le titulaire du compte entreprise assure la
                gestion.
              </span>
            </label>
            <div
              className="flex flex-wrap gap-4"
              role="group"
              aria-label="Devise du forfait"
            >
              {["USD", "EUR", "CDF"].map((c) => (
                <label key={c} className="flex gap-2">
                  <input
                    type="radio"
                    checked={currency === c}
                    disabled={busy}
                    onChange={() => setCurrency(c)}
                  />
                  {c}
                </label>
              ))}
            </div>
            {quote && (
              <div className="rounded-xl border p-4">
                <p className="font-bold">
                  {quote.monthlyAmount} {currency} / mois
                </p>
                <p className="text-sm">
                  Tarif ENTERPRISE_MONTHLY configuré en base. Le mois
                  d’activation est facturé en entier à la fin du mois, sans
                  prorata.
                </p>
              </div>
            )}
            {error && (
              <p role="alert" className="text-red-600">
                {error}
              </p>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={accepted}
                disabled={busy || !quote}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              Je confirme le forfait et l’activation du mode entreprise.
            </label>
            <label className="grid gap-2">
              Votre PIN de gestionnaire
              <Input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                minLength={4}
                maxLength={6}
                pattern="[0-9]{4,6}"
                required
                value={pin}
                disabled={busy}
                onChange={(e) => setPin(e.target.value)}
              />
            </label>
            <Button disabled={busy || !quote || !accepted} type="submit">
              {busy ? "Activation…" : "Activer le compte entreprise"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
