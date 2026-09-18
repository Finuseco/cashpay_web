

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Boutique } from "@/lib/types";

const formSchema = z.object({
  name: z.string().min(3, { message: "Le nom de la boutique doit contenir au moins 3 caractères." }),
  address: z.string().min(10, { message: "Veuillez fournir une adresse complète." }),
  whatsapp_public_number: z
    .string()
    .min(8, { message: "Veuillez fournir un numéro WhatsApp valide." })
    .max(30, { message: "Le numéro WhatsApp est trop long." }),
});

interface AddEditBoutiqueFormProps {
  onFormSubmit: (boutique: Omit<Boutique, 'id'> & { id?: string }) => void;
  initialData?: Boutique | null;
}

export function AddEditBoutiqueForm({ onFormSubmit, initialData }: AddEditBoutiqueFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      address: initialData?.address || '',
      whatsapp_public_number:
        (initialData as (Boutique & {
          whatsapp_public_number?: string | null;
        }) | null)?.whatsapp_public_number || '',
    },
  });

  function handleSubmit(values: z.infer<typeof formSchema>) {
    const boutiqueData = {
      ...values,
    } as Omit<Boutique, 'id'> & {
      id?: string;
      whatsapp_public_number: string;
    };
    if (initialData?.id) {
        boutiqueData.id = initialData.id;
    }
    onFormSubmit(boutiqueData);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nom de la boutique</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Boutique Gombe Centre" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse</FormLabel>
              <FormControl>
                <Input placeholder="Ex: 123 Av. du Commerce, Gombe, Kinshasa" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="whatsapp_public_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Numéro WhatsApp public</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="Ex: +243 812 345 678"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" variant="gradient" className="w-full font-bold">
          {initialData ? 'Enregistrer les modifications' : 'Ajouter la boutique'}
        </Button>
      </form>
    </Form>
  );
}
