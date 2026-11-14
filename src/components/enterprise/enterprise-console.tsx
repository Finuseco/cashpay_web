"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  Users,
  Wallet,
  Calculator,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
async function api(path = "", body?: object, signal?: AbortSignal) {
  const r = await fetch("/api/v1/enterprise" + path, {
    method: body ? "POST" : "GET",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = await r.json();
  if (!r.ok || !data.success)
    throw Error(data.error || "Service indisponible.");
  return data;
}
const box = "space-y-2 rounded-xl border p-4";
const roleLabel = (value: string) =>
  ({
    manager: "Gérant",
    treasurer: "Trésorier",
    accountant: "Comptable",
    cashier: "Caissier",
  })[value] || value;
const statusLabel = (value: string) =>
  ({
    pending: "En attente",
    approved: "Validée",
    disputed: "En litige",
    rejected: "Rejetée",
  })[value] || value;
function Field({
  label,
  name,
  type = "text",
  defaultValue = "",
  required = true,
  ...rest
}: any) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        {...rest}
      />
    </label>
  );
}
function Pin() {
  return (
    <Field
      label="Votre code PIN CashPay"
      name="pin"
      type="password"
      inputMode="numeric"
      pattern="[0-9]{4,6}"
      minLength={4}
      maxLength={6}
      autoComplete="off"
    />
  );
}
export function EnterpriseConsole() {
  const [companies, setCompanies] = useState<any[]>([]),
    [companyId, setCompanyId] = useState(0),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number[]>([]),
    [months, setMonths] = useState<string[]>([]),
    [newMonth, setNewMonth] = useState(""),
    [currency, setCurrency] = useState("USD"),
    [quote, setQuote] = useState<any>(null),
    [quoteError, setQuoteError] = useState(""),
    [quoteBusy, setQuoteBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [payPin, setPayPin] = useState(""),
    [consent, setConsent] = useState(false),
    [requestKey, setRequestKey] = useState(""),
    [confirmationDigest, setConfirmationDigest] = useState("");
  const [edit, setEdit] = useState<any>(null),
    [review, setReview] = useState<any>(null);
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    if (!companyId) return;
    const snapshot = await api("?companyId=" + companyId);
    setData(snapshot);
    setMonths((old) => (old.length ? old : [snapshot.month]));
    setNewMonth((old) => old || snapshot.month);
  }, [companyId]);
  useEffect(() => {
    let alive = true;
    api()
      .then((result) => {
        if (alive) {
          setCompanies(result.companies);
          setCompanyId(result.companies[0]?.id || 0);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    setData(null);
    setSelected([]);
    setMonths([]);
    setQuote(null);
    if (companyId)
      refresh().catch((e) => {
        if (alive) setError(e.message);
      });
    const timer = setInterval(() => {
      if (!document.hidden && !lock.current) void refresh().catch(() => {});
    }, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [companyId, refresh]);
  useEffect(() => {
    setQuote(null);
    setQuoteError("");
    if (!data || !selected.length || !months.length) {
      setQuoteBusy(false);
      return;
    }
    const abort = new AbortController();
    setQuoteBusy(true);
    const timer = setTimeout(() => {
      api(
        "",
        { action: "preview", companyId, userIds: selected, months, currency },
        abort.signal,
      )
        .then((q) => {
          if (!abort.signal.aborted) setQuote(q);
        })
        .catch((e) => {
          if (!abort.signal.aborted) setQuoteError(e.message);
        })
        .finally(() => {
          if (!abort.signal.aborted) setQuoteBusy(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [companyId, selected, months, currency, data]);
  useEffect(() => {
    if (confirm && quote && quote.digest !== confirmationDigest) {
      setConfirm(false);
      setPayPin("");
      setConsent(false);
      setError(
        "Le devis a changé. Vérifiez les nouveaux montants avant de confirmer.",
      );
    }
  }, [confirm, quote, confirmationDigest]);
  async function submit(
    event: React.FormEvent<HTMLFormElement>,
    action: string,
    extra: object = {},
  ) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget,
      values = Object.fromEntries(new FormData(form));
    lock.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const payload: any = { ...values, ...extra, companyId, action };
      if (action === "employee" || action === "member")
        payload.active = new FormData(form).get("active") === "on";
      if (action === "adjustment") payload.userId = Number(payload.userId);
      if (payload.currency)
        payload.currency = String(payload.currency).trim().toUpperCase();
      await api("", payload);
      setSuccess("Modification enregistrée dans l’historique.");
      setEdit(null);
      setReview(null);
      form.reset();
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      const input = form.querySelector<HTMLInputElement>('[name="pin"]');
      if (input) input.value = "";
      lock.current = false;
      setBusy(false);
    }
  }
  async function pay() {
    if (lock.current || !quote || !consent) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api("", {
        action: "pay",
        companyId,
        userIds: selected,
        months,
        currency,
        digest: quote.digest,
        requestKey,
        pin: payPin,
      });
      setSuccess(
        `Paie ${result.replayed ? "déjà enregistrée" : "confirmée"}. Référence ${result.payment.reference}.`,
      );
      setConfirm(false);
      setSelected([]);
      await refresh();
    } catch (e: any) {
      const status = await api(
        "?companyId=" + companyId + "&requestKey=" + requestKey,
      ).catch(() => null);
      if (status?.payment) {
        setSuccess(
          "Paie retrouvée dans l’historique. Référence " +
            status.payment.reference,
        );
        setConfirm(false);
        setSelected([]);
        await refresh().catch(() => {});
      } else
        setError(e.message + " Vérifiez l’historique avant de recommencer.");
    } finally {
      setPayPin("");
      lock.current = false;
      setBusy(false);
    }
  }
  if (loading)
    return <p className="p-6">Chargement de vos accès entreprise…</p>;
  if (!companies.length)
    return (
      <main className="p-6 space-y-3">
        <Building2 />
        <h1 className="text-xl font-bold">Compte entreprise</h1>
        <p>
          {error ||
            "Un compte entreprise activé ou une habilitation du gérant est requis."}
        </p>
        <p>Contactez votre administrateur ou super-agent pour l’activation.</p>
      </main>
    );
  const manager = data?.role === "manager",
    canPay = ["manager", "treasurer"].includes(data?.role);
  const employees = (data?.employees || []).filter(
      (e: any) => e.active && e.currency === currency,
    ),
    eligible = employees.filter(
      (e: any) => !months.some((m) => e.paidMonths?.includes(m)),
    );
  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Building2 />
            Espace entreprise
          </h1>
          <p className="text-sm text-muted-foreground">
            Salariés, avances, paie groupée et forfait mensuel.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => refresh().catch((e) => setError(e.message))}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualiser
        </Button>
      </header>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Entreprise"
      >
        {companies.map((c) => (
          <Button
            key={c.id}
            variant={c.id === companyId ? "default" : "outline"}
            disabled={busy}
            onClick={() => {
              setError("");
              setCompanyId(c.id);
            }}
          >
            {c.name}
          </Button>
        ))}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500 p-4 text-red-600"
        >
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-xl border border-green-500 p-4">
          {success}
        </p>
      )}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle className="text-base break-words">
                  {data.company.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="break-all font-mono text-sm">
                  {data.company.walletId}
                </p>
                <p className="text-sm">Habilitation : {roleLabel(data.role)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4" />
                  Portefeuille
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(data.balance).map(([ccy, value]) => (
                  <p key={ccy} className="break-words font-semibold">
                    {Number(value).toLocaleString("fr-FR", {
                      maximumFractionDigits: 2,
                    })}{" "}
                    {ccy}
                  </p>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Forfait mensuel</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  {data.monthlyAmount} {data.monthlyCurrency} / mois
                </p>
                <p className="text-sm">
                  Frais CashPay remplacés par le forfait.
                </p>
                {data.dueMonths.length > 0 && (
                  <p className="text-red-600">
                    À régulariser : {data.dueMonths.join(", ")}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
          <Tabs defaultValue="payroll">
            <TabsList className="flex h-auto justify-start overflow-x-auto">
              <TabsTrigger value="payroll">Paie</TabsTrigger>
              <TabsTrigger value="employees">Salariés</TabsTrigger>
              <TabsTrigger value="deductions">Retenues et litiges</TabsTrigger>
              <TabsTrigger value="team">Équipe</TabsTrigger>
              <TabsTrigger value="history">Historique</TabsTrigger>
            </TabsList>
            <TabsContent value="payroll" className="space-y-4">
              <section className={box}>
                <h2 className="flex items-center gap-2 font-semibold">
                  <Calculator className="h-5 w-5" />
                  Préparer une paie
                </h2>
                <div className="flex flex-wrap gap-4">
                  <label className="grid gap-1 text-sm">
                    Devise
                    <Input
                      className="w-28"
                      maxLength={3}
                      value={currency}
                      onChange={(e) => {
                        setCurrency(e.target.value.toUpperCase());
                        setSelected([]);
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Ajouter un mois
                    <Input
                      type="month"
                      max={data.month}
                      value={newMonth}
                      onChange={(e) => setNewMonth(e.target.value)}
                    />
                  </label>
                  <Button
                    variant="outline"
                    className="self-end"
                    disabled={
                      months.length >= 12 || !newMonth || newMonth > data.month
                    }
                    onClick={() =>
                      setMonths((old) =>
                        [...new Set([...old, newMonth])].sort(),
                      )
                    }
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Ajouter
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {months.map((m) => (
                    <Button
                      key={m}
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setMonths((old) => old.filter((v) => v !== m))
                      }
                      aria-label={"Retirer " + m}
                    >
                      {m} ×
                    </Button>
                  ))}
                </div>
              </section>
              <section className={box}>
                <label className="flex items-center gap-3 font-semibold">
                  <input
                    type="checkbox"
                    checked={
                      eligible.length > 0 &&
                      eligible.every((e: any) => selected.includes(e.userId))
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? eligible.slice(0, 200).map((v: any) => v.userId)
                          : [],
                      )
                    }
                  />
                  {eligible.length > 200
                    ? "Sélectionner les 200 premiers"
                    : "Tout sélectionner"}{" "}
                  ({eligible.length} disponibles)
                </label>
                <div className="divide-y">
                  {employees.map((employee: any) => {
                    const paid = months.some((m) =>
                      employee.paidMonths?.includes(m),
                    );
                    return (
                      <label
                        key={employee.userId}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <input
                            type="checkbox"
                            disabled={
                              paid ||
                              (selected.length >= 200 &&
                                !selected.includes(employee.userId))
                            }
                            checked={selected.includes(employee.userId)}
                            onChange={(e) =>
                              setSelected((old) =>
                                e.target.checked
                                  ? [...old, employee.userId]
                                  : old.filter((id) => id !== employee.userId),
                              )
                            }
                          />
                          <span className="min-w-0">
                            <span className="block break-words font-medium">
                              {employee.name}
                            </span>
                            <span className="block break-all font-mono text-xs">
                              {employee.walletId}
                            </span>
                            {paid && (
                              <span className="text-xs text-muted-foreground">
                                Une période sélectionnée est déjà payée.
                              </span>
                            )}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm">
                          {employee.salary} {employee.currency}/mois
                        </span>
                      </label>
                    );
                  })}
                  {!employees.length && (
                    <p className="py-4 text-muted-foreground">
                      Aucun salarié actif dans cette devise.
                    </p>
                  )}
                </div>
              </section>
              <section className={box} aria-live="polite">
                <h2 className="font-semibold">
                  {selected.length} salarié(s) · {months.length} mois
                </h2>
                {quoteBusy ? (
                  <p>Calcul des salaires et vérification du solde…</p>
                ) : quoteError ? (
                  <p role="alert" className="text-red-600">
                    {quoteError}
                  </p>
                ) : quote ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr>
                            <th>Salarié</th>
                            <th>Brut</th>
                            <th>Retenues validées</th>
                            <th>Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quote.lines.map((line: any) => (
                            <tr key={line.userId} className="border-t">
                              <td className="py-3 pr-4">{line.name}</td>
                              <td className="pr-4">{line.gross}</td>
                              <td className="pr-4">{line.deduction}</td>
                              <td>{line.net}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-lg font-bold">
                      Total à débiter : {quote.total} {currency}
                    </p>
                    <p>
                      Solde disponible : {quote.balance} {currency}
                    </p>
                    <p
                      className={
                        quote.sufficient ? "text-green-700" : "text-red-600"
                      }
                    >
                      {quote.sufficient
                        ? "Solde suffisant pour toute la sélection."
                        : "Solde insuffisant : décochez des salariés ou approvisionnez le compte."}
                    </p>
                  </>
                ) : (
                  <p>Sélectionnez les salariés et les mois à régler.</p>
                )}
                <Button
                  disabled={!canPay || busy || quoteBusy || !quote?.sufficient}
                  onClick={() => {
                    setRequestKey(crypto.randomUUID());
                    setConfirmationDigest(quote.digest);
                    setPayPin("");
                    setConsent(false);
                    setConfirm(true);
                  }}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Confirmer la paie groupée
                </Button>
              </section>
            </TabsContent>
            <TabsContent value="employees" className="space-y-4">
              <section className={box}>
                <h2 className="font-semibold">Répertoire des salariés</h2>
                {data.employees.map((e: any) => (
                  <div
                    key={e.userId}
                    className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
                  >
                    <div>
                      <p className="font-semibold">
                        {e.name} · {e.active ? "Actif" : "Inactif"}
                      </p>
                      <p className="break-all font-mono text-xs">
                        {e.walletId}
                      </p>
                      <p>
                        {e.salary} {e.currency}/mois · depuis {e.startMonth}
                      </p>
                    </div>
                    {manager && (
                      <Button variant="outline" onClick={() => setEdit(e)}>
                        Modifier
                      </Button>
                    )}
                  </div>
                ))}
              </section>
              {manager && (
                <form
                  key={edit?.walletId || "new"}
                  className={box}
                  onSubmit={(e) => submit(e, "employee")}
                >
                  <h2 className="font-semibold">
                    {edit
                      ? "Modifier le salarié"
                      : "Ajouter un salarié existant"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Le salarié doit déjà posséder un compte CashPay actif.
                  </p>
                  <fieldset
                    disabled={busy}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <Field
                      label="ID Wallet du salarié"
                      name="walletId"
                      defaultValue={edit?.walletId || ""}
                    />
                    <Field
                      label="Salaire mensuel brut"
                      name="salary"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={edit?.salary || ""}
                    />
                    <Field
                      label="Devise"
                      name="currency"
                      maxLength={3}
                      defaultValue={edit?.currency || currency}
                    />
                    <Field
                      label="Mois d’entrée"
                      name="startMonth"
                      type="month"
                      max={data.month}
                      defaultValue={edit?.startMonth || data.month}
                    />
                    <label className="flex items-center gap-2">
                      <input
                        name="active"
                        type="checkbox"
                        defaultChecked={edit?.active ?? true}
                      />
                      Salarié actif
                    </label>
                    <Pin />
                  </fieldset>
                  <Button disabled={busy}>
                    <Users className="mr-2 h-4 w-4" />
                    Enregistrer
                  </Button>
                  {edit && (
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setEdit(null)}
                    >
                      Annuler
                    </Button>
                  )}
                </form>
              )}
            </TabsContent>
            <TabsContent value="deductions" className="space-y-4">
              <form className={box} onSubmit={(e) => submit(e, "adjustment")}>
                <h2 className="font-semibold">
                  Consigner une avance ou une dette
                </h2>
                <p className="text-sm text-muted-foreground">
                  Cet enregistrement ne verse pas d’argent. Une retenue doit
                  être validée par le gérant ; un litige bloque la paie du
                  salarié concerné.
                </p>
                <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    Salarié
                    <div className="max-h-44 overflow-y-auto rounded-lg border p-3">
                      {data.employees
                        .filter((e: any) => e.active)
                        .map((e: any) => (
                          <label className="flex gap-2 py-1" key={e.userId}>
                            <input
                              required
                              type="radio"
                              name="userId"
                              value={e.userId}
                            />
                            {e.name}
                          </label>
                        ))}
                    </div>
                  </label>
                  <Field
                    label="Montant de la retenue"
                    name="amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                  />
                  <Field
                    label="Devise du salaire"
                    name="currency"
                    defaultValue={currency}
                    maxLength={3}
                  />
                  <Field
                    label="Mois d’imputation"
                    name="month"
                    type="month"
                    max={data.month}
                    defaultValue={data.month}
                  />
                  <Field
                    label="Motif et justificatif"
                    name="reason"
                    minLength={5}
                    maxLength={1000}
                  />
                  <Pin />
                </fieldset>
                <Button disabled={busy}>Soumettre au gérant</Button>
              </form>
              <section className={box}>
                <h2 className="font-semibold">Retenues et décisions</h2>
                {data.adjustments.map((a: any) => (
                  <article key={a.key} className="space-y-2 border-b py-3">
                    <p className="font-semibold">
                      {
                        data.employees.find((e: any) => e.userId === a.userId)
                          ?.name
                      }{" "}
                      · {a.amount} {a.currency} · {a.month}
                    </p>
                    <p className="break-words">{a.reason}</p>
                    <p>État : {statusLabel(a.status)}</p>
                    <p className="text-sm">
                      Déjà imputé : {a.applied} · Reste : {a.remaining}{" "}
                      {a.currency}
                    </p>
                    {a.reviewReason && (
                      <p className="text-sm">Décision : {a.reviewReason}</p>
                    )}
                    {manager && (
                      <div className="flex flex-wrap gap-2">
                        {[
                          ["approved", "Valider"],
                          ["disputed", "Mettre en litige"],
                          ["rejected", "Rejeter"],
                        ].map(([decision, label]) => (
                          <Button
                            key={decision}
                            size="sm"
                            variant="outline"
                            disabled={busy || Number(a.applied) > 0}
                            onClick={() => setReview({ ...a, decision })}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </section>
            </TabsContent>
            <TabsContent value="team" className="space-y-4">
              <section className={box}>
                <h2 className="font-semibold">Habilitations</h2>
                <p>
                  Le gérant valide les retenues et les salaires. Le trésorier
                  peut exécuter la paie. Le comptable et le caissier peuvent
                  consigner les avances et consulter les dossiers.
                </p>
                {data.members.map((m: any) => (
                  <p key={m.userId} className="border-b py-3">
                    {m.name} · {roleLabel(m.role)} ·{" "}
                    {m.active ? "Actif" : "Révoqué"}
                    <span className="block break-all font-mono text-xs">
                      {m.walletId}
                    </span>
                  </p>
                ))}
              </section>
              {manager && (
                <form className={box} onSubmit={(e) => submit(e, "member")}>
                  <h2 className="font-semibold">
                    Attribuer ou révoquer une habilitation
                  </h2>
                  <fieldset disabled={busy} className="grid gap-3">
                    <Field label="ID Wallet du collaborateur" name="walletId" />
                    <div className="flex flex-wrap gap-4">
                      {[
                        ["manager", "Gérant"],
                        ["treasurer", "Trésorier"],
                        ["accountant", "Comptable"],
                        ["cashier", "Caissier"],
                      ].map(([value, label]) => (
                        <label key={value} className="flex items-center gap-2">
                          <input
                            required
                            type="radio"
                            name="role"
                            value={value}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <label className="flex gap-2">
                      <input type="checkbox" name="active" defaultChecked />
                      Habilitation active
                    </label>
                    <Pin />
                  </fieldset>
                  <Button disabled={busy}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Enregistrer l’habilitation
                  </Button>
                </form>
              )}
            </TabsContent>
            <TabsContent value="history" className="space-y-4">
              <section className={box}>
                <h2 className="font-semibold">Dernières paies</h2>
                {data.payments.map((p: any) => (
                  <article key={p.key} className="space-y-1 border-b py-3">
                    <p className="font-semibold">
                      {p.periods.join(", ")} · {p.lines.length} salariés ·{" "}
                      {p.currency}
                    </p>
                    <p className="break-all font-mono text-xs">{p.reference}</p>
                    <details>
                      <summary className="cursor-pointer py-2">
                        Voir le détail
                      </summary>
                      {p.lines.map((l: any) => (
                        <p className="py-1 text-sm" key={l.userId}>
                          {l.name} : brut {l.gross}, retenues {l.deduction}, net{" "}
                          {l.net} {p.currency}
                        </p>
                      ))}
                    </details>
                  </article>
                ))}
              </section>
              <section className={box}>
                <h2 className="font-semibold">Forfaits mensuels</h2>
                {data.bills.map((b: any) => (
                  <p key={b.key} className="border-b py-3">
                    {b.key} · {b.amount} {b.currency} ·{" "}
                    {b.status === "paid" ? "Prélevé" : "En attente"}
                    <span className="block break-all text-xs">
                      {b.reference}
                    </span>
                  </p>
                ))}
              </section>
            </TabsContent>
          </Tabs>
        </>
      )}
      <Dialog
        open={confirm}
        onOpenChange={(open) => {
          if (!busy) {
            setConfirm(open);
            setPayPin("");
          }
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Autoriser le paiement des salaires</DialogTitle>
          </DialogHeader>
          <p>
            {selected.length} salariés · {months.join(", ")}
          </p>
          <p className="text-xl font-bold">
            {quote?.total} {currency}
          </p>
          <p>
            Le solde et les retenues seront vérifiés à nouveau. Toute la
            sélection est payée, ou aucun salaire ne l’est.
          </p>
          <label className="grid gap-2">
            Votre PIN
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={payPin}
              disabled={busy}
              onChange={(e) => setPayPin(e.target.value)}
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              disabled={busy}
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            J’autorise le débit du compte entreprise pour cette paie.
          </label>
          {error && (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          )}
          <Button
            disabled={
              busy ||
              !consent ||
              !quote?.sufficient ||
              !/^[0-9]{4,6}$/.test(payPin)
            }
            onClick={pay}
          >
            {busy
              ? "Paiement en cours…"
              : "Payer tous les salariés sélectionnés"}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!review}
        onOpenChange={(open) => {
          if (!busy && !open) setReview(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Décision du gérant</DialogTitle>
          </DialogHeader>
          {review && (
            <form
              className="space-y-3"
              onSubmit={(e) =>
                submit(e, "review", {
                  key: review.key,
                  decision: review.decision,
                })
              }
            >
              <p>
                {review.amount} {review.currency} · {review.month} ·{" "}
                {statusLabel(review.decision)}
              </p>
              <Field
                label="Motif de la décision"
                name="reason"
                minLength={5}
                maxLength={1000}
              />
              <Pin />
              <Button disabled={busy}>Confirmer la décision</Button>
              {error && (
                <p role="alert" className="text-red-600">
                  {error}
                </p>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
