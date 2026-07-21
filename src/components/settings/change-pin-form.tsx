
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const formSchema = z.object({
  oldPin: z.string().min(4, "Le PIN doit contenir 4 chiffres."),
  newPin: z.string().min(4, "Le PIN doit contenir 4 chiffres."),
  confirmPin: z.string().min(4, "Le PIN doit contenir 4 chiffres."),
}).refine((data) => data.newPin === data.confirmPin, {
  message: "Les nouveaux codes PIN ne correspondent pas.",
  path: ["confirmPin"],
});

interface ChangePinFormProps {
    onFormSubmit: (values: z.infer<typeof formSchema>) => void;
}

export function ChangePinForm({ onFormSubmit }: ChangePinFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      oldPin: '',
      newPin: '',
      confirmPin: ''
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-6 pt-4">
        <FormField
          control={form.control}
          name="oldPin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ancien PIN</FormLabel>
              <FormControl>
                <div className="flex justify-center">
                    <InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="newPin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nouveau PIN</FormLabel>
              <FormControl>
                <div className="flex justify-center">
                    <InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
         <FormField
          control={form.control}
          name="confirmPin"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmer le nouveau PIN</FormLabel>
              <FormControl>
                 <div className="flex justify-center">
                    <InputOTP maxLength={4} {...field}><InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /><InputOTPSlot index={3} /></InputOTPGroup></InputOTP>
                 </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="gradient" className="w-full font-bold">
          Changer le PIN
        </Button>
      </form>
    </Form>
  );
}
