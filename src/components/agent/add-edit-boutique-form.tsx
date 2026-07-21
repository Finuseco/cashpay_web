

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
});

interface AddEditBoutiqueFormProps {
  onFormSubmit: (boutique: Omit<Boutique, 'id'> & { id?: string }) => void;
  initialData?: Boutique | null;
}

export function AddEditBoutiqueForm({ onFormSubmit, initialData }: AddEditBoutiqueFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: '',
      address: '',
    },
  });

  function handleSubmit(values: z.infer<typeof formSchema>) {
    const boutiqueData: Omit<Boutique, 'id'> & { id?: string } = {
      ...values,
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
        <Button type="submit" variant="gradient" className="w-full font-bold">
          {initialData ? 'Enregistrer les modifications' : 'Ajouter la boutique'}
        </Button>
      </form>
    </Form>
  );
}
