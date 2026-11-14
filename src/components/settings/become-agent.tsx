"use client";
import { useEffect, useState } from "react";
import type { User } from "@/lib/types";
import {
  getAgentSubscription,
  subscribeAsAgent,
  setAutoRenew,
  type AgentSubscription,
} from "@/lib/actions/agent-application.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
export function BecomeAgentSection({
  user,
  onRenewed,
}: {
  user: User | null;
  onRenewed?: () => void;
}) {
  const [subscription, setSubscription] = useState<AgentSubscription | null>(
      null,
    ),
    [loaded, setLoaded] = useState(false),
    [plan, setPlan] = useState<"normal" | "promo">("normal"),
    [fee, setFee] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [pin, setPin] = useState(""),
    [confirm, setConfirm] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function refresh() {
    if (user) {
      const sub = await getAgentSubscription(user.id);
      setSubscription(sub);
      if (
        sub?.status === "active" &&
        sub.current_period_end &&
        new Date(sub.current_period_end).getTime() > Date.now()
      )
        onRenewed?.();
      setLoaded(true);
    }
  }
  useEffect(() => {
    let live = true;
    if (user)
      getAgentSubscription(user.id)
        .then((s) => {
          if (live) {
            setSubscription(s);
            setLoaded(true);
            if (s) setPlan("normal");
          }
        })
        .catch(() => {
          if (live) setError("Statut indisponible. Réessayez.");
        });
    return () => {
      live = false;
    };
  }, [user?.id]);
  useEffect(() => {
    let live = true;
    setFee(null);
    setConfirm(false);
    fetch(`/api/v1/agent/subscription/fees?plan=${plan}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!live) return;
        if (!data.success || !Number.isFinite(data.fee))
          throw Error(data.error || "Tarif indisponible.");
        setFee(data.fee);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [plan, user?.id]);
  const active =
    subscription?.status === "active" &&
    !!subscription.current_period_end &&
    new Date(subscription.current_period_end).getTime() > Date.now();
  async function renew(e: React.FormEvent) {
    e.preventDefault();
    if (!user || fee === null || busy || !confirm) return;
    setBusy(true);
    setError("");
    try {
      const result = await subscribeAsAgent(
        user.id,
        subscription ? "normal" : plan,
        pin,
        fee,
      );
      if (!result.success) throw Error(result.error);
      setPin("");
      setConfirm(false);
      setMessage("Abonnement Agent renouvelé pour 30 jours.");
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function automatic(enabled: boolean) {
    if (!user || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await setAutoRenew(user.id, enabled);
      if (!r.success) throw Error(r.error);
      await refresh();
      setMessage(
        enabled
          ? "Renouvellement automatique activé. Après un échec, nouvelle tentative toutes les 48 heures."
          : "Renouvellement automatique désactivé. Vous pourrez renouveler manuellement.",
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4">
      <h3 className="font-semibold">Abonnement Agent</h3>
      {!loaded ? (
        <div>
          <p role="status">Chargement du statut…</p>
          {error && (
            <Button
              variant="outline"
              onClick={() =>
                refresh().catch(() =>
                  setError("Statut indisponible. Réessayez."),
                )
              }
            >
              Réessayer
            </Button>
          )}
        </div>
      ) : (
        <>
          <p>
            {active ? "Actif" : "Expiré ou non activé"}
            {subscription?.current_period_end &&
              ` — fin : ${new Date(subscription.current_period_end).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}`}
          </p>
          {subscription && (
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={!!subscription.auto_renew}
                disabled={busy}
                onChange={(e) => automatic(e.target.checked)}
              />
              <span>
                Renouveler automatiquement au tarif standard. En cas d’échec,
                réessayer après 48 heures, sans découvert.
              </span>
            </label>
          )}
          {!active && (
            <form onSubmit={renew} className="space-y-4">
              {!subscription && (
                <RadioGroup
                  value={plan}
                  onValueChange={(v) => {
                    setPlan(v as any);
                    setError("");
                  }}
                >
                  <label className="flex gap-2">
                    <RadioGroupItem value="normal" />
                    Standard, 30 jours
                  </label>
                  <label className="flex gap-2">
                    <RadioGroupItem value="promo" />
                    Première activation, 30 jours
                  </label>
                </RadioGroup>
              )}
              <p className="font-semibold">
                Montant à autoriser :{" "}
                {fee === null
                  ? "Chargement du tarif…"
                  : `${fee.toFixed(2)} USD`}
              </p>
              <label className="block">
                Votre PIN
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  maxLength={4}
                  required
                />
              </label>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                  required
                />
                J’autorise ce prélèvement pour 30 jours.
              </label>
              <Button
                disabled={busy || fee === null || pin.length !== 4 || !confirm}
              >
                {busy
                  ? "Traitement…"
                  : subscription
                    ? "Renouveler manuellement"
                    : "Activer mon abonnement"}
              </Button>
            </form>
          )}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              refresh().catch(() => setError("Statut indisponible."))
            }
          >
            Actualiser le statut
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
