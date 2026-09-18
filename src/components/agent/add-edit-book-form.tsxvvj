"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Trash2, ScanLine, Sparkles, UploadCloud, X, CalendarIcon, User as UserIcon, FileText, BookOpen, ShieldCheck, Wrench, Loader2, Barcode as BarcodeIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { QrScannerDialog } from "@/components/shared/qr-scanner-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import type { Product, Boutique } from "@/lib/types";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const bookFormSchema = z.object({
  name: z.string().min(3, { message: "Le titre du livre est requis." }),
  subtitle: z.string().optional(),
  author: z.string().min(2, { message: "Le nom de l'auteur est requis." }),
  publisher: z.string().min(2, { message: "La maison d'édition est requise." }),
  language: z.string().min(2, { message: "La langue est requise." }),
  publicationDate: z.date({ required_error: "La date de publication est requise." }),
  description: z.string().min(10, { message: "Une description est requise." }),
  isbn10: z.string().optional(),
  isbn13: z.string().min(10, "L'ISBN est obligatoire pour prouver la propriété."),
  barcode: z.string().min(1, "Le code-barres ou SKU est requis."),
  
  editionType: z.enum(['cashpay', 'external']).default('external'),
  authorBio: z.string().min(10, "Une courte biographie de l'auteur est requise."),
  conclusion: z.string().optional(),
  
  images: z.array(z.string()).optional(), 
  authorImage: z.string().optional(),
  pdfUrl: z.string().min(1, "Le fichier PDF du manuscrit est obligatoire."),
  sourceUrl: z.string().min(1, "Le fichier source (EPUB/Doc) est obligatoire pour prouver l'auctorialité."),
  audioUrl: z.string().optional(),
  
  sellingPrice: z.coerce.number().min(0.01, "Le prix de vente est requis."),
  pageCount: z.string().min(1, "Le nombre de pages est requis."),
  bookSize: z.string().optional(),
  boutiqueId: z.string({ required_error: "Veuillez sélectionner une boutique." }),
  stock: z.coerce.number().int().min(0, "Le stock est requis."),
  isPublic: z.boolean().default(true),
});

interface AddEditBookFormProps {
  onFormSubmit: (product: Partial<Product>) => void;
  boutiques: Boutique[];
  initialData?: Product | null;
}

export function AddEditBookForm({ onFormSubmit, boutiques, initialData }: AddEditBookFormProps) {
  const { toast } = useToast();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const frontCoverRef = useRef<HTMLInputElement>(null);
  const backCoverRef = useRef<HTMLInputElement>(null);
  const authorPhotoRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof bookFormSchema>>({
    resolver: zodResolver(bookFormSchema),
    mode: 'onSubmit',
    defaultValues: initialData ? {
        ...initialData,
        ...initialData.details,
        publicationDate: initialData.details?.publicationDate ? new Date(initialData.details.publicationDate) : new Date(),
        images: initialData.images || [],
        boutiqueId: initialData.boutiqueId || '',
        pageCount: initialData.details?.pageCount || '',
        isPublic: initialData.isPublic ?? true,
    } : {
      name: '',
      subtitle: '',
      author: '',
      publisher: 'CashPay Digital Edition',
      language: 'Français',
      publicationDate: new Date(),
      description: '',
      editionType: 'external',
      authorBio: '',
      isbn10: '',
      isbn13: '',
      barcode: '',
      images: [],
      sellingPrice: 0,
      boutiqueId: '',
      stock: 100,
      isPublic: true,
      pdfUrl: '',
      sourceUrl: '',
      pageCount: '',
    },
  });
  
  const editionType = form.watch('editionType');
  const imagePreviews = form.watch('images') || [];
  const authorImagePreview = form.watch('authorImage');

  const handleGenerateIsbn = () => {
    const randomSuffix = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    const generatedIsbn = `978-CP-${randomSuffix.substring(0, 4)}-${randomSuffix.substring(4, 7)}`;
    form.setValue('isbn13', generatedIsbn, { shouldValidate: true });
    form.setValue('barcode', generatedIsbn.replace(/-/g, ''), { shouldValidate: true });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: any, index?: number) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            if (index !== undefined) {
                const current = [...(form.getValues('images') || [])];
                current[index] = dataUrl;
                form.setValue('images', current, { shouldValidate: true, shouldDirty: true });
            } else {
                form.setValue(fieldName, dataUrl, { shouldValidate: true, shouldDirty: true });
            }
        };
        reader.readAsDataURL(file);
    }
  };

  async function handleSubmit(values: z.infer<typeof bookFormSchema>) {
    setIsSubmitting(true);
    const productData: Partial<Product> = { 
        id: initialData?.id, 
        name: values.name,
        description: values.description,
        images: values.images || [],
        sellingPrice: values.sellingPrice,
        barcode: values.barcode,
        isbn10: values.isbn10,
        isbn13: values.isbn13,
        stock: values.stock,
        isPublic: values.isPublic,
        boutiqueId: values.boutiqueId,
        categoryId: 'cat-livre',
        details: {
            ...values,
            publicationDate: values.publicationDate.toISOString(),
        }
    };
    try {
        await onFormSubmit(productData);
    } catch (error) {
        console.error("Submission error:", error);
    } finally {
        setIsSubmitting(false);
    }
  }

  // Helper to show errors if the form is invalid but handleSubmit isn't called
  const onInvalid = (errors: any) => {
      console.log("Validation Errors:", errors);
      toast({
          title: "Formulaire incomplet",
          description: "Veuillez remplir tous les champs obligatoires (marqués d'un astérisque *).",
          variant: "destructive"
      });
  };

  return (
    <>
      <QrScannerDialog open={isScannerOpen} onOpenChange={setIsScannerOpen} onScanSuccess={(txt) => form.setValue('barcode', txt, { shouldValidate: true })} mode="barcode" />
      <div className="max-h-[75vh] overflow-y-auto pr-2 space-y-8 pb-10">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit, onInvalid)} className="space-y-6 pt-4">
            
            <FormField control={form.control} name="editionType" render={({ field }) => (
                <FormItem className="space-y-3">
                    <FormLabel>Type d'Édition</FormLabel>
                    <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <RadioGroupItem value="external" id="ed-ext" className="sr-only peer" />
                                <Label htmlFor="ed-ext" className="flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted transition-all text-center">
                                    <BookOpen className="h-6 w-6 mb-2"/> Édition Extérieure
                                </Label>
                            </div>
                            <div className="relative">
                                <RadioGroupItem value="cashpay" id="ed-cp" className="sr-only peer" />
                                <Label htmlFor="ed-cp" className="flex flex-col items-center justify-center p-4 border-2 rounded-xl cursor-pointer peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted transition-all text-center">
                                    <ShieldCheck className="h-6 w-6 mb-2 text-primary"/> Édition CashPay (Souveraine)
                                </Label>
                            </div>
                        </RadioGroup>
                    </FormControl>
                </FormItem>
            )}/>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Preuves d'auctorialité (Obligatoire)</h3>
                    <FormField control={form.control} name="pdfUrl" render={({ field }) => (
                        <FormItem>
                            <FormLabel className={cn(field.value ? "text-green-600 font-bold" : "text-red-500")}>Manuscrit PDF *</FormLabel>
                            <FormControl><div className="flex gap-2"><Input type="file" accept=".pdf" className="h-10" onChange={e => handleFileChange(e, 'pdfUrl')} /><FileText className={cn("h-10 w-10 shrink-0", field.value ? "text-green-500" : "text-zinc-300")}/></div></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="sourceUrl" render={({ field }) => (
                        <FormItem>
                            <FormLabel className={cn(field.value ? "text-green-600 font-bold" : "text-red-500")}>Fichier Source (Doc/Epub) *</FormLabel>
                            <FormControl><div className="flex gap-2"><Input type="file" accept=".doc,.docx,.epub" className="h-10" onChange={e => handleFileChange(e, 'sourceUrl')} /><Wrench className={cn("h-10 w-10 shrink-0", field.value ? "text-green-500" : "text-zinc-300")}/></div></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}/>
                </div>

                <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Couverture & Volume</h3>
                    {editionType === 'external' ? (
                        <div className="grid grid-cols-2 gap-2">
                             <button type="button" onClick={() => frontCoverRef.current?.click()} className="relative aspect-[2/3] border-2 border-dashed rounded-lg flex flex-col items-center justify-center overflow-hidden bg-muted">
                                {imagePreviews[0] ? <img src={imagePreviews[0]} alt="Front" className="h-full w-full object-cover"/> : <><UploadCloud className="mb-1 text-zinc-400"/><span className="text-[10px]">RECTO</span></>}
                             </button>
                             <button type="button" onClick={() => backCoverRef.current?.click()} className="relative aspect-[2/3] border-2 border-dashed rounded-lg flex flex-col items-center justify-center overflow-hidden bg-muted">
                                {imagePreviews[1] ? <img src={imagePreviews[1]} alt="Back" className="h-full w-full object-cover"/> : <><UploadCloud className="mb-1 text-zinc-400"/><span className="text-[10px]">VERSO</span></>}
                             </button>
                             <input type="file" ref={frontCoverRef} className="hidden" onChange={e => handleFileChange(e, null, 0)} />
                             <input type="file" ref={backCoverRef} className="hidden" onChange={e => handleFileChange(e, null, 1)} />
                        </div>
                    ) : (
                        <div className="aspect-[1.1] rounded-xl bg-gradient-to-br from-[#000E38] to-[#001a5e] p-6 flex flex-col justify-between text-white shadow-xl relative overflow-hidden border-2 border-primary/20">
                             <div className="absolute top-0 right-0 p-2 opacity-10"><ShieldCheck className="h-24 w-24" /></div>
                            <div className="text-center z-10">
                                <p className="font-bold text-sm leading-tight line-clamp-2 uppercase tracking-tight">{form.watch('name') || 'TITRE DU LIVRE'}</p>
                                <p className="text-[10px] mt-1 opacity-70 italic">{form.watch('author') || 'NOM DE L\'AUTEUR'}</p>
                            </div>
                            <div className="flex justify-center z-10">
                                <div className="bg-white/10 p-2 rounded-md border border-white/20 backdrop-blur-sm">
                                    <BarcodeIcon className="h-8 w-16 opacity-30"/>
                                </div>
                            </div>
                        </div>
                    )}
                    <FormField control={form.control} name="images" render={() => <FormMessage />} />
                </div>
            </div>

            <Separator/>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                     <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Titre du Livre *</FormLabel><FormControl><Input placeholder="Titre officiel" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                     <FormField control={form.control} name="author" render={({ field }) => ( <FormItem><FormLabel>Nom de l'auteur *</FormLabel><FormControl><Input placeholder="Prénom Nom" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                     
                     <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="language" render={({ field }) => ( <FormItem><FormLabel>Langue *</FormLabel><FormControl><Input placeholder="Français" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="pageCount" render={({ field }) => ( <FormItem><FormLabel>Pages *</FormLabel><FormControl><Input placeholder="Ex: 240" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                     </div>

                     <FormField control={form.control} name="isbn13" render={({ field }) => ( 
                        <FormItem>
                            <FormLabel className="text-red-500">Numéro ISBN-13 *</FormLabel>
                            <div className="flex gap-2">
                                <FormControl><Input placeholder="978-..." {...field} className="font-mono"/></FormControl>
                                {editionType === 'cashpay' && (
                                    <Button type="button" variant="outline" size="sm" onClick={handleGenerateIsbn}>Générer</Button>
                                )}
                            </div>
                            <FormMessage />
                        </FormItem> 
                    )}/>
                </div>
                <div className="space-y-4">
                    <FormField control={form.control} name="authorImage" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Photo de l'auteur (Optionnel)</FormLabel>
                            <div onClick={() => authorPhotoRef.current?.click()} className="h-20 w-20 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden bg-muted hover:border-primary transition-all">
                                {authorImagePreview ? <img src={authorImagePreview} alt="Author" className="h-full w-full object-cover"/> : <UserIcon className="text-zinc-400"/>}
                            </div>
                            <input type="file" ref={authorPhotoRef} className="hidden" onChange={e => handleFileChange(e, 'authorImage')} />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="authorBio" render={({ field }) => ( <FormItem><FormLabel>À propos de l'auteur *</FormLabel><FormControl><Textarea rows={2} placeholder="Courte biographie..." {...field} /></FormControl><FormMessage /></FormItem> )}/>
                    <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Présentation (Résumé) *</FormLabel><FormControl><Textarea rows={3} placeholder="Résumé captivant..." {...field} /></FormControl><FormMessage /></FormItem> )}/>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                <FormField control={form.control} name="publisher" render={({ field }) => ( <FormItem><FormLabel>Maison d'Édition *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="publicationDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Date de Publication *</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {field.value ? format(field.value, "d MMMM yyyy", { locale: fr }) : <span>Choisir une date</span>}
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )}/>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
                 <FormField control={form.control} name="sellingPrice" render={({ field }) => ( <FormItem> <FormLabel>Prix de vente ($) *</FormLabel> <FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem> )} />
                 <FormField control={form.control} name="stock" render={({ field }) => ( <FormItem> <FormLabel>Quantité / Stock *</FormLabel> <FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                 <FormField control={form.control} name="boutiqueId" render={({ field }) => ( <FormItem><FormLabel>Boutique *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionnez..." /></SelectTrigger></FormControl><SelectContent>{boutiques.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
            </div>

            <Button type="submit" variant="gradient" className="w-full h-14 text-lg font-bold shadow-xl" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {initialData ? 'Enregistrer les modifications' : 'Publier mon livre sur JoJo Market'}
            </Button>
        </form>
      </Form>
      </div>
    </>
  );
}
