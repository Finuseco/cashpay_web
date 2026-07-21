
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Trash2, ScanLine, Sparkles, UploadCloud, X, Weight, Calendar } from "lucide-react";
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
import { Checkbox } from "../ui/checkbox";
import { QrScannerDialog } from "@/components/shared/qr-scanner-dialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import Barcode from "react-barcode";
import { PROVINCES_BY_COUNTRY } from "@/lib/provinces";
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { countryToCode } from "@/lib/utils";
import type { Product, ProductCategory, Boutique } from "@/lib/types";
import { Textarea } from "../ui/textarea";

// --- Formulaire de produit (intégré) ---
const productFormSchema = z.object({
  name: z.string().min(3, { message: "Le nom du produit doit contenir au moins 3 caractères." }),
  description: z.string().optional(),
  categoryId: z.string({ required_error: "Veuillez sélectionner une catégorie." }),
  boutiqueId: z.string({ required_error: "Veuillez sélectionner une boutique." }),
  purchasePrice: z.coerce.number().optional(),
  sellingPrice: z.coerce.number().min(0.01, "Le prix de vente est requis."),
  barcode: z.string().min(1, { message: "Le code-barres est requis." }),
  images: z.array(z.string()).min(1, "Veuillez téléverser au moins une image.").max(5, "Vous ne pouvez téléverser que 5 images au maximum."),
  isPublic: z.boolean().default(false).optional(),
  weight: z.coerce.number().positive("Le poids doit être un nombre positif.").optional(),
  variations: z.array(z.object({
      color: z.string().min(1, "La couleur est requise."),
      stock: z.coerce.number().int().min(0, "Le stock doit être un nombre positif."),
  })).min(1, "Vous devez ajouter au moins une variation de produit (couleur/stock)."),
  promotionalPackages: z.array(z.object({
      minQuantity: z.coerce.number().int().min(2, "La quantité minimale doit être d'au moins 2."),
      price: z.coerce.number().positive("Le prix promotionnel doit être positif."),
  })).optional(),
  shippingRates: z.array(z.object({
      destination: z.string().min(1, "La destination est requise."),
      pricePerKg: z.coerce.number().min(0, "Le prix doit être positif."),
  })).optional(),
}).refine(data => {
    if (data.promotionalPackages) {
        for (const pkg of data.promotionalPackages) {
            if (pkg.price >= data.sellingPrice) {
                return false;
            }
        }
    }
    return true;
}, {
    message: "Le prix promotionnel doit être inférieur au prix de vente normal.",
    path: ["promotionalPackages"],
});

interface AddEditProductFormProps {
  onFormSubmit: (product: Partial<Product>) => void;
  categories: ProductCategory[];
  boutiques: Boutique[];
  initialData?: Product | null;
}

export function AddEditProductForm({ onFormSubmit, categories, boutiques, initialData }: AddEditProductFormProps) {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [agentCountry, setAgentCountry] = useState('CD'); // Default country

  useEffect(() => {
    const fetchAgentCountry = async () => {
        const agent = await getAuthenticatedUser();
        if (agent?.country) {
            const code = countryToCode(agent.country);
            if (code) setAgentCountry(code);
        }
    };
    fetchAgentCountry();
  }, []);

  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialData ? {
        ...initialData,
        images: initialData.images || [],
        purchasePrice: initialData.purchasePrice ?? undefined,
        sellingPrice: initialData.sellingPrice ?? undefined,
        variations: initialData.variations && initialData.variations.length > 0 ? initialData.variations : [{ color: 'Unique', stock: initialData.stock || 0 }],
        promotionalPackages: initialData.promotionalPackages || [],
        shippingRates: initialData.shippingRates || [],
        weight: initialData.weight ?? undefined,
        categoryId: initialData.categoryId || '',
        boutiqueId: initialData.boutiqueId || '',
    } : {
      name: '',
      description: '',
      categoryId: '',
      boutiqueId: '',
      purchasePrice: undefined,
      sellingPrice: undefined,
      barcode: '',
      images: [],
      isPublic: false,
      variations: [{ color: 'Unique', stock: 0 }],
      promotionalPackages: [],
      shippingRates: [],
      weight: undefined,
    },
  });
  
  const { fields: promoFields, append: appendPromo, remove: removePromo } = useFieldArray({ control: form.control, name: "promotionalPackages" });
  const { fields: variationFields, append: appendVariation, remove: removeVariation } = useFieldArray({ control: form.control, name: "variations" });
  const { fields: shippingFields, append: appendShipping, remove: removeShipping } = useFieldArray({ control: form.control, name: "shippingRates" });

  const imagePreviews = form.watch('images');
  const barcodeValue = form.watch('barcode');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
        const currentPreviews = form.getValues('images') || [];
        const totalImages = currentPreviews.length + files.length;
        if (totalImages > 5) { alert("Vous ne pouvez pas dépasser 5 images."); return; }
        Array.from(files).forEach(file => {
             const reader = new FileReader();
             reader.onloadend = () => {
                const dataUrl = reader.result as string;
                form.setValue('images', [...(form.getValues('images') || []), dataUrl], { shouldValidate: true });
            };
            reader.readAsDataURL(file);
        });
    }
  };

  const removeImage = (index: number) => {
    form.setValue('images', (form.getValues('images') || []).filter((_, i) => i !== index), { shouldValidate: true });
  }
  
  const handleGenerateBarcode = () => { form.setValue('barcode', `CP${Date.now()}`); };
  const handleScanSuccess = useCallback((scannedText: string) => { form.setValue('barcode', scannedText); setIsScannerOpen(false); }, [form]);

  function handleSubmit(values: z.infer<typeof productFormSchema>) {
    const totalStock = values.variations.reduce((sum, v) => sum + v.stock, 0);
    const productData: Partial<Product> = { id: initialData?.id, ...values, stock: totalStock };
    onFormSubmit(productData);
  }

  const provincesForCountry = PROVINCES_BY_COUNTRY[agentCountry as keyof typeof PROVINCES_BY_COUNTRY] || [];

  return (
    <>
      <QrScannerDialog open={isScannerOpen} onOpenChange={setIsScannerOpen} onScanSuccess={handleScanSuccess} />
      <div className="max-h-[70vh] overflow-y-auto pr-2">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="images"
              render={() => (
                <FormItem>
                  <FormLabel>Images du Produit (jusqu'à 5)</FormLabel>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {imagePreviews.map((src, index) => (
                      <div key={index} className="relative aspect-square">
                        <Image src={src} alt={`Aperçu ${index+1}`} fill className="rounded-md object-cover" />
                        <button type="button" onClick={() => removeImage(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5"><X className="h-3 w-3"/></button>
                      </div>
                    ))}
                    {imagePreviews.length < 5 && (
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square flex flex-col justify-center items-center w-full h-full bg-zinc-700/50 border-2 border-dashed border-zinc-600 rounded-md hover:border-primary">
                        <UploadCloud className="w-6 h-6 text-zinc-400" />
                      </button>
                    )}
                  </div>
                  <FormControl>
                    <input ref={fileInputRef} type="file" className="sr-only" accept="image/*" multiple onChange={handleImageChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nom du Produit</FormLabel><FormControl><Input placeholder="Ex: T-shirt en coton" {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="categoryId" render={({ field }) => ( <FormItem><FormLabel>Catégorie</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionnez une catégorie" /></SelectTrigger></FormControl><SelectContent>{categories.filter(c => c.id !== 'cat-livre').map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Décrivez votre produit en détail..." {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="boutiqueId" render={({ field }) => ( <FormItem><FormLabel>Boutique</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionnez une boutique" /></SelectTrigger></FormControl><SelectContent>{boutiques.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="purchasePrice" render={({ field }) => ( <FormItem> <FormLabel>Prix d'achat ($) (Optionnel)</FormLabel> <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )} />
              <FormField control={form.control} name="sellingPrice" render={({ field }) => ( <FormItem> <FormLabel>Prix de vente ($)</FormLabel> <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl> <FormMessage /> </FormItem> )} />
            </div>

            <FormField control={form.control} name="weight" render={({ field }) => ( <FormItem> <FormLabel>Poids du produit (kg)</FormLabel> <div className="relative"><FormControl><Input type="number" step="0.1" placeholder="Ex: 1.2" {...field} value={field.value ?? ''} className="pl-8" /></FormControl><Weight className="absolute left-2 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400"/></div><FormMessage /> </FormItem> )}/>

            <div className="space-y-4 rounded-lg border p-4">
              <FormLabel>Variations du produit (par couleur)</FormLabel><FormDescription>Gérez le stock pour chaque couleur.</FormDescription>
              {variationFields.map((field, index) => ( <div key={field.id} className="flex items-end gap-2 border-t pt-3"> <FormField control={form.control} name={`variations.${index}.color`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Couleur</FormLabel><FormControl><Input placeholder="Ex: Rouge" {...field} /></FormControl><FormMessage/></FormItem>)}/> <FormField control={form.control} name={`variations.${index}.stock`} render={({ field }) => (<FormItem className="w-24"><FormLabel>Stock</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage/></FormItem>)}/> <Button type="button" variant="destructive" size="icon" onClick={() => removeVariation(index)}><Trash2 className="h-4 w-4"/></Button> </div> ))}
              <Button type="button" variant="outline" size="sm" onClick={() => appendVariation({ color: '', stock: 0 })}>Ajouter une couleur</Button>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <FormLabel>Promotions par quantité</FormLabel><FormDescription>Proposez des prix réduits pour les achats en gros.</FormDescription>
              {promoFields.map((field, index) => ( <div key={field.id} className="flex items-end gap-2 border-t pt-3"> <FormField control={form.control} name={`promotionalPackages.${index}.minQuantity`} render={({ field }) => (<FormItem><FormLabel>Qté Min</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage/></FormItem>)}/> <FormField control={form.control} name={`promotionalPackages.${index}.price`} render={({ field }) => (<FormItem><FormLabel>Prix Promo ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage/></FormItem>)}/> <Button type="button" variant="destructive" size="icon" onClick={() => removePromo(index)}><Trash2 className="h-4 w-4"/></Button> </div> ))}
              <Button type="button" variant="outline" size="sm" onClick={() => appendPromo({ minQuantity: 10, price: 0 })}>Ajouter un pack promo</Button>
            </div>
            
             <div className="space-y-4 rounded-lg border p-4">
              <FormLabel>Frais de Livraison</FormLabel><FormDescription>Définissez les frais de livraison par kg pour chaque province.</FormDescription>
              {shippingFields.map((field, index) => ( <div key={field.id} className="flex items-end gap-2 border-t pt-3"> <FormField control={form.control} name={`shippingRates.${index}.destination`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Province</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Choisir une province..."/></SelectTrigger></FormControl><SelectContent>{provincesForCountry.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)}/> <FormField control={form.control} name={`shippingRates.${index}.pricePerKg`} render={({ field }) => (<FormItem className="w-32"><FormLabel>Prix/kg ($)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage/></FormItem>)}/> <Button type="button" variant="destructive" size="icon" onClick={() => removeShipping(index)}><Trash2 className="h-4 w-4"/></Button> </div> ))}
              <Button type="button" variant="outline" size="sm" onClick={() => appendShipping({ destination: '', pricePerKg: 0 })}>Ajouter un tarif</Button>
            </div>

            <FormField control={form.control} name="barcode" render={({ field }) => ( <FormItem><FormLabel>Code-barres</FormLabel><FormControl><Input placeholder="Scannez ou générez un code" {...field} /></FormControl><FormDescription><div className="flex items-center justify-between gap-2"><div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setIsScannerOpen(true)}><ScanLine className="mr-2 h-4 w-4" /> Scanner</Button><Button type="button" size="sm" variant="outline" onClick={handleGenerateBarcode}><Sparkles className="mr-2 h-4 w-4" /> Générer</Button></div>{barcodeValue && (<div className="bg-white p-1 rounded-sm"><Barcode value={barcodeValue} height={40} width={1.5} fontSize={12} /></div>)}</div></FormDescription><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="isPublic" render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange}/></FormControl><div className="space-y-1 leading-none"><FormLabel>Rendre ce produit public</FormLabel><FormDescription>Si coché, ce produit sera visible par tous les clients dans le Market public.</FormDescription></div></FormItem> )}/>
            <Button type="submit" variant="gradient" className="w-full font-bold">{initialData ? 'Enregistrer les modifications' : 'Ajouter le produit'}</Button>
        </form>
      </Form>
      </div>
    </>
  );
}
