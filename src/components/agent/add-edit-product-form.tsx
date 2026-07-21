"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Trash2, ScanLine, Sparkles, UploadCloud, X, Weight } from "lucide-react";
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
import { getAuthenticatedUser } from "@/lib/actions/user.actions";
import { countryToCode } from "@/lib/utils";
import type { Product, ProductCategory, Boutique } from "@/lib/types";
import { Textarea } from "../ui/textarea";

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
});

export function AddEditProductForm({ onFormSubmit, categories, boutiques, initialData }: { onFormSubmit: (p: Partial<Product>) => void, categories: ProductCategory[], boutiques: Boutique[], initialData?: Product | null }) {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialData ? {
        ...initialData,
        images: initialData.images || [],
        variations: initialData.variations && initialData.variations.length > 0 ? initialData.variations : [{ color: 'Unique', stock: initialData.stock || 0 }],
        categoryId: initialData.categoryId || '',
        boutiqueId: initialData.boutiqueId || '',
    } : {
      name: '',
      description: '',
      categoryId: '',
      boutiqueId: '',
      barcode: '',
      images: [],
      isPublic: false,
      variations: [{ color: 'Unique', stock: 0 }],
    },
  });
  
  const { fields: variationFields, append: appendVariation, remove: removeVariation } = useFieldArray({ control: form.control, name: "variations" });
  const imagePreviews = form.watch('images');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
        Array.from(files).forEach(file => {
             const reader = new FileReader();
             reader.onloadend = () => {
                form.setValue('images', [...(form.getValues('images') || []), reader.result as string], { shouldValidate: true });
            };
            reader.readAsDataURL(file);
        });
    }
  };

  const handleScanSuccess = (scannedText: string) => { 
    form.setValue('barcode', scannedText, { shouldValidate: true }); 
    setIsScannerOpen(false); 
  };

  return (
    <>
      <QrScannerDialog open={isScannerOpen} onOpenChange={setIsScannerOpen} onScanSuccess={handleScanSuccess} mode="barcode" />
      <div className="max-h-[70vh] overflow-y-auto pr-2">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="images" render={() => (
                <FormItem>
                  <FormLabel>Images du Produit</FormLabel>
                  <div className="grid grid-cols-5 gap-2">
                    {imagePreviews.map((src, index) => (
                      <div key={index} className="relative aspect-square">
                        <Image src={src} alt="Preview" fill className="rounded-md object-cover" />
                        <button type="button" onClick={() => form.setValue('images', imagePreviews.filter((_, i) => i !== index))} className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-0.5"><X className="h-3 w-3"/></button>
                      </div>
                    ))}
                    {imagePreviews.length < 5 && (
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square flex items-center justify-center bg-zinc-700/50 border-2 border-dashed border-zinc-600 rounded-md"><UploadCloud className="w-6 h-6 text-zinc-400" /></button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple onChange={handleImageChange} />
                </FormItem>
            )}/>
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nom du Produit</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )}/>
            <FormField control={form.control} name="barcode" render={({ field }) => ( 
                <FormItem><FormLabel>Code-barres / SKU</FormLabel>
                    <div className="flex gap-2">
                        <FormControl><Input {...field} /></FormControl>
                        <Button type="button" variant="outline" onClick={() => setIsScannerOpen(true)}><ScanLine className="h-4 w-4"/></Button>
                    </div>
                </FormItem> 
            )}/>
            <Button type="submit" variant="gradient" className="w-full font-bold">Enregistrer</Button>
        </form>
      </Form>
      </div>
    </>
  );
}
