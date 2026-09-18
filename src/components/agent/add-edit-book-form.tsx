"use client";

import { useMemo, useRef, useState } from "react";
import { BookOpen, Check, FileAudio, FileText, ImagePlus, Loader2, Plus, ScanLine, Search, ShieldCheck, Trash2, UploadCloud, User as UserIcon, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";
import { QrScannerDialog } from "@/components/shared/qr-scanner-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Product, Boutique } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

const bookFormSchema = z.object({
  name: z.string().trim().min(3, "Le titre du livre est requis."),
  subtitle: z.string().optional(),
  author: z.string().trim().min(2, "Le nom de l'auteur est requis."),
  publisher: z.string().trim().min(2, "La maison d'édition est requise."),
  language: z.string().trim().min(2, "La langue est requise."),
  publicationDate: z.string().min(1, "La date de publication est requise."),
  description: z.string().trim().min(10, "Une description est requise."),
  isbn10: z.string().optional(),
  isbn13: z.string().trim().min(10, "L'ISBN est obligatoire pour prouver la propriété."),
  barcode: z.string().trim().min(1, "Le code-barres ou SKU est requis."),
  editionType: z.enum(["cashpay", "external"]),
  authorBio: z.string().trim().min(10, "Une courte biographie de l'auteur est requise."),
  conclusion: z.string().optional(),
  images: z.array(z.string()).min(1, "Ajoutez au moins une image de couverture."),
  authorImage: z.string().optional(),
  pdfUrl: z.string().min(1, "Le fichier PDF du manuscrit est obligatoire."),
  sourceUrl: z.string().min(1, "Le fichier source (EPUB/Doc) est obligatoire pour prouver l'auctorialité."),
  audioUrl: z.string().optional(),
  sellingPrice: z.coerce.number().min(0.01, "Le prix de vente est requis."),
  pageCount: z.string().trim().min(1, "Le nombre de pages est requis."),
  bookSize: z.string().optional(),
  boutiqueId: z.string().min(1, "Veuillez sélectionner une boutique."),
  stock: z.coerce.number().int().min(0, "Le stock est requis."),
  isPublic: z.boolean().default(true),
});

type FormValues = z.infer<typeof bookFormSchema>;

type Props = {
  onFormSubmit: (product: Partial<Product>) => void | Promise<void>;
  boutiques: Boutique[];
  initialData?: Product | null;
};

type SearchOption = { value: string; label: string; description?: string };

function SearchableRadioGroup({ label, value, onChange, options, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchOption[];
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase();
  const filtered = useMemo(() => options.filter((option) => {
    if (!q) return true;
    return option.label.toLocaleLowerCase().includes(q) || option.description?.toLocaleLowerCase().includes(q);
  }), [options, q]);

  return (
    <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{label} *</p>
          <p className="text-xs text-slate-400">Recherchez puis sélectionnez une seule option.</p>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-slate-400">{options.length}</span>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} className="pl-9" />
      </div>
      <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {filtered.map((option) => (
          <label key={option.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${value === option.value ? "border-blue-500/70 bg-blue-500/10" : "border-white/10 bg-slate-900/40"}`}>
            <input type="radio" name={label.replace(/\s+/g, "-").toLowerCase()} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="h-4 w-4 shrink-0 accent-blue-600" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-white">{option.label}</span>
              {option.description && <span className="block truncate text-[11px] text-slate-500">{option.description}</span>}
            </span>
          </label>
        ))}
      </div>
      {!filtered.length && <p className="rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-slate-500">Aucun résultat.</p>}
    </div>
  );
}

const today = new Date().toISOString().slice(0, 10);

export function AddEditBookForm({ onFormSubmit, boutiques, initialData }: Props) {
  const { toast } = useToast();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileBusy, setFileBusy] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const backCoverRef = useRef<HTMLInputElement>(null);
  const authorPhotoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const sourceRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);

  const details = ((initialData as any)?.details || {}) as Record<string, any>;
  const initialImages = Array.isArray(initialData?.images) ? initialData!.images : [];

  const form = useForm<FormValues>({
    resolver: zodResolver(bookFormSchema),
    mode: "onSubmit",
    defaultValues: {
      name: initialData?.name || "",
      subtitle: String(details.subtitle || ""),
      author: String(details.author || ""),
      publisher: String(details.publisher || "CashPay Digital Edition"),
      language: String(details.language || "Français"),
      publicationDate: details.publicationDate ? new Date(details.publicationDate).toISOString().slice(0, 10) : today,
      description: initialData?.description || String(details.description || ""),
      isbn10: String((initialData as any)?.isbn10 || details.isbn10 || ""),
      isbn13: String((initialData as any)?.isbn13 || details.isbn13 || ""),
      barcode: initialData?.barcode || "",
      editionType: details.editionType === "cashpay" ? "cashpay" : "external",
      authorBio: String(details.authorBio || ""),
      conclusion: String(details.conclusion || ""),
      images: initialImages,
      authorImage: String(details.authorImage || ""),
      pdfUrl: String(details.pdfUrl || ""),
      sourceUrl: String(details.sourceUrl || ""),
      audioUrl: String(details.audioUrl || ""),
      sellingPrice: Number((initialData as any)?.sellingPrice ?? 0),
      pageCount: String(details.pageCount || ""),
      bookSize: String(details.bookSize || ""),
      boutiqueId: String((initialData as any)?.boutiqueId || ""),
      stock: Number((initialData as any)?.stock ?? 0),
      isPublic: initialData?.isPublic ?? true,
    },
  });

  const images = form.watch("images") || [];
  const editionType = form.watch("editionType");

  const readFile = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
    reader.readAsDataURL(file);
  });

  const handleCover = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = await readFile(file);
      const next = [...(form.getValues("images") || [])];
      next[index] = data;
      form.setValue("images", next.slice(0, 5), { shouldValidate: true, shouldDirty: true });
    } catch (error: any) {
      toast({ title: "Image", description: error?.message || "Impossible de charger l'image.", variant: "destructive" });
    }
  };

  const handleAuthorImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try { form.setValue("authorImage", await readFile(file), { shouldDirty: true }); }
    catch { toast({ title: "Photo", description: "Impossible de charger la photo.", variant: "destructive" }); }
  };

  const handleBookFile = async (e: React.ChangeEvent<HTMLInputElement>, field: "pdfUrl" | "sourceUrl" | "audioUrl") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileBusy(field);
    try {
      form.setValue(field, await readFile(file), { shouldValidate: true, shouldDirty: true });
    } catch {
      toast({ title: "Fichier", description: "Impossible de lire ce fichier.", variant: "destructive" });
    } finally { setFileBusy(null); }
  };

  const generateIsbn = () => {
    const digits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const isbn = `978-CP-${digits.slice(0, 4)}-${digits.slice(4, 7)}`;
    form.setValue("isbn13", isbn, { shouldValidate: true, shouldDirty: true });
    form.setValue("barcode", isbn.replace(/-/g, ""), { shouldValidate: true, shouldDirty: true });
  };

  const removeCover = (index: number) => {
    const next = [...(form.getValues("images") || [])];
    next.splice(index, 1);
    form.setValue("images", next, { shouldValidate: true, shouldDirty: true });
  };

  const submit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const payload: Partial<Product> = {
        id: initialData?.id,
        name: values.name,
        description: values.description,
        images: values.images,
        sellingPrice: values.sellingPrice,
        barcode: values.barcode,
        isbn10: values.isbn10,
        isbn13: values.isbn13,
        stock: values.stock,
        isPublic: values.isPublic,
        boutiqueId: values.boutiqueId,
        categoryId: "cat-livre",
        details: {
          ...details,
          ...values,
          publicationDate: new Date(`${values.publicationDate}T00:00:00`).toISOString(),
        },
      };
      await onFormSubmit(payload);
      toast({ title: initialData ? "Livre modifié" : "Livre publié", description: initialData ? "Les modifications ont été enregistrées." : "Le livre a été envoyé pour publication." });
    } catch (error: any) {
      toast({ title: "Erreur", description: error?.message || "Impossible d'enregistrer le livre.", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  const onInvalid = () => toast({ title: "Formulaire incomplet", description: "Veuillez remplir les champs obligatoires marqués d'un astérisque (*).", variant: "destructive" });

  return (
    <>
      <QrScannerDialog open={isScannerOpen} onOpenChange={setIsScannerOpen} onScanSuccess={(txt) => { form.setValue("barcode", txt, { shouldValidate: true, shouldDirty: true }); setIsScannerOpen(false); }} mode="barcode" />
      <div className="max-h-[78vh] overflow-y-auto pr-1 pb-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit, onInvalid)} className="space-y-5 pt-2">
            <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl sm:p-5">
              <div className="mb-4 flex items-center gap-3"><BookOpen className="h-5 w-5 text-blue-400" /><div><h2 className="text-base font-semibold text-white">Publication du livre</h2><p className="text-xs text-slate-400">Informations éditoriales et preuves d'auctorialité.</p></div></div>
              <FormField control={form.control} name="editionType" render={({ field }) => (
                <FormItem><FormLabel>Type d'édition *</FormLabel><FormControl><RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${field.value === "external" ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-slate-900/40"}`}><RadioGroupItem value="external" /><BookOpen className="h-5 w-5" /><span>Édition extérieure</span></Label>
                  <Label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${field.value === "cashpay" ? "border-blue-500 bg-blue-500/10" : "border-white/10 bg-slate-900/40"}`}><RadioGroupItem value="cashpay" /><ShieldCheck className="h-5 w-5" /><span>Édition CashPay</span></Label>
                </RadioGroup></FormControl></FormItem>
              )} />
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="name" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Titre du livre *</FormLabel><FormControl><Input {...field} placeholder="Titre officiel" /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="subtitle" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Sous-titre</FormLabel><FormControl><Input {...field} placeholder="Sous-titre (facultatif)" /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="author" render={({ field }) => <FormItem><FormLabel>Auteur *</FormLabel><FormControl><Input {...field} placeholder="Prénom Nom" /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="publisher" render={({ field }) => <FormItem><FormLabel>Maison d'édition *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="language" render={({ field }) => <FormItem><FormLabel>Langue *</FormLabel><FormControl><Input {...field} placeholder="Français" /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="publicationDate" render={({ field }) => <FormItem><FormLabel>Date de publication *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="pageCount" render={({ field }) => <FormItem><FormLabel>Nombre de pages *</FormLabel><FormControl><Input {...field} inputMode="numeric" placeholder="240" /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="bookSize" render={({ field }) => <FormItem><FormLabel>Format du livre</FormLabel><FormControl><Input {...field} placeholder="A5, 15 × 21 cm..." /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="description" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Résumé / présentation *</FormLabel><FormControl><Textarea {...field} rows={4} placeholder="Présentez le contenu du livre..." /></FormControl><FormMessage /></FormItem>} />
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl sm:p-5">
              <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-blue-400" /><h2 className="text-base font-semibold text-white">Identifiants du livre</h2></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="isbn13" render={({ field }) => <FormItem><FormLabel>ISBN-13 *</FormLabel><div className="flex gap-2"><FormControl><Input {...field} className="font-mono" placeholder="978-..." /></FormControl>{editionType === "cashpay" && <Button type="button" variant="outline" onClick={generateIsbn}>Générer</Button>}</div><FormMessage /></FormItem>} />
                <FormField control={form.control} name="isbn10" render={({ field }) => <FormItem><FormLabel>ISBN-10</FormLabel><FormControl><Input {...field} className="font-mono" placeholder="ISBN-10 (facultatif)" /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="barcode" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Code-barres / SKU *</FormLabel><div className="flex gap-2"><FormControl><Input {...field} className="font-mono" placeholder="Saisissez ou scannez le code" /></FormControl><Button type="button" variant="outline" onClick={() => setIsScannerOpen(true)} aria-label="Scanner le code-barres"><ScanLine className="h-4 w-4" /></Button></div><FormMessage /></FormItem>} />
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl sm:p-5">
              <FormField control={form.control} name="boutiqueId" render={({ field }) => <FormItem><FormControl><SearchableRadioGroup label="Boutique de publication" value={field.value} onChange={field.onChange} options={boutiques.map((b: any) => ({ value: String(b.id), label: String(b.name || `Boutique ${b.id}`), description: b.address ? String(b.address) : undefined }))} placeholder="Rechercher une boutique..." /></FormControl><FormDescription>Le livre sera enregistré avec cette boutique via <code>boutique_id</code>.</FormDescription><FormMessage /></FormItem>} />
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl sm:p-5">
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="sellingPrice" render={({ field }) => <FormItem><FormLabel>Prix de vente *</FormLabel><FormControl><Input type="number" min="0.01" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="stock" render={({ field }) => <FormItem><FormLabel>Stock *</FormLabel><FormControl><Input type="number" min="0" step="1" {...field} /></FormControl><FormMessage /></FormItem>} />
              </div>
              <FormField control={form.control} name="isPublic" render={({ field }) => <FormItem className="flex items-center gap-3 rounded-xl border border-white/10 p-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div><FormLabel>Publier sur JoJo Market</FormLabel><FormDescription>Rend le produit public selon la logique existante.</FormDescription></div></FormItem>} />
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl sm:p-5">
              <div className="mb-4 flex items-center gap-2"><ImagePlus className="h-5 w-5 text-blue-400" /><h2 className="text-base font-semibold text-white">Couverture et auteur</h2></div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2 grid grid-cols-2 gap-3">
                  {[0, 1].map((index) => <button key={index} type="button" onClick={() => (index === 0 ? coverRef.current : backCoverRef.current)?.click()} className="relative aspect-[2/3] overflow-hidden rounded-xl border-2 border-dashed border-white/15 bg-slate-900/60 text-slate-400">
                    {images[index] ? <img src={images[index]} alt={index === 0 ? "Couverture" : "Verso"} className="h-full w-full object-cover" /> : <span className="flex h-full flex-col items-center justify-center gap-2"><UploadCloud className="h-7 w-7" /><span>{index === 0 ? "Couverture" : "Verso"}</span></span>}
                    {images[index] && <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeCover(index); }} className="absolute right-2 top-2 rounded-full bg-red-600 p-1.5 text-white"><X className="h-3 w-3" /></span>}
                  </button>)}
                  <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCover(e, 0)} />
                  <input ref={backCoverRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleCover(e, 1)} />
                </div>
                <div className="space-y-4">
                  <FormField control={form.control} name="authorImage" render={({ field }) => <FormItem><FormLabel>Photo de l'auteur</FormLabel><div onClick={() => authorPhotoRef.current?.click()} className="flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-white/15 bg-slate-900/60">{field.value ? <img src={field.value} alt="Auteur" className="h-full w-full object-cover" /> : <UserIcon className="h-8 w-8 text-slate-500" />}</div><input ref={authorPhotoRef} type="file" accept="image/*" className="hidden" onChange={handleAuthorImage} /></FormItem>} />
                  <FormField control={form.control} name="authorBio" render={({ field }) => <FormItem><FormLabel>Biographie de l'auteur *</FormLabel><FormControl><Textarea {...field} rows={4} placeholder="Courte biographie..." /></FormControl><FormMessage /></FormItem>} />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-xl sm:p-5">
              <div className="mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-blue-400" /><h2 className="text-base font-semibold text-white">Fichiers du livre</h2></div>
              <div className="grid gap-4 sm:grid-cols-3">
                {([
                  ["pdfUrl", "Manuscrit PDF *", ".pdf", pdfRef, FileText],
                  ["sourceUrl", "Source EPUB / Doc *", ".epub,.doc,.docx", sourceRef, Wrench],
                  ["audioUrl", "Livre audio", ".mp3,.wav,.m4a,.aac", audioRef, FileAudio],
                ] as const).map(([fieldName, label, accept, ref, Icon]) => <FormField key={fieldName} control={form.control} name={fieldName} render={({ field }) => <FormItem><FormLabel>{label}</FormLabel><button type="button" onClick={() => ref.current?.click()} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left ${field.value ? "border-emerald-500/50 bg-emerald-500/5" : "border-dashed border-white/15 bg-slate-900/50"}`}><Icon className="h-5 w-5 shrink-0" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{field.value ? "Fichier sélectionné" : "Choisir un fichier"}</span><span className="text-[11px] text-slate-500">{accept}</span></span>{fileBusy === fieldName ? <Loader2 className="ml-auto h-4 w-4 animate-spin" /> : field.value ? <Check className="ml-auto h-4 w-4 text-emerald-400" /> : null}</button><input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => handleBookFile(e, fieldName)} /><FormMessage /></FormItem>} />)}
              </div>
            </section>

            <FormField control={form.control} name="conclusion" render={({ field }) => <FormItem><FormLabel>Conclusion / notes</FormLabel><FormControl><Textarea {...field} rows={3} placeholder="Informations complémentaires (facultatif)" /></FormControl><FormMessage /></FormItem>} />

            <Button type="submit" variant="gradient" className="h-14 w-full text-base font-bold shadow-xl" disabled={isSubmitting || !!fileBusy}>{isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Enregistrement...</> : <><Check className="mr-2 h-5 w-5" /> {initialData ? "Enregistrer les modifications" : "Publier mon livre"}</>}</Button>
          </form>
        </Form>
      </div>
    </>
  );
}
