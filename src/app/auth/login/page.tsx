
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { login } from '@/lib/actions/auth.actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [state, formAction] = useFormState(login, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state?.message === 'success') {
      // Redirigez en fonction du rôle.
      // Dans une application réelle, la gestion des sessions serait plus complexe.
      if (state.role === 'admin') {
        router.push('/admin/dashboard');
      } else if (state.role === 'cashier') {
        router.push('/cashier/dashboard');
      } else {
        router.push('/');
      }
    }
  }, [state, router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Connexion</CardTitle>
          <CardDescription>
            Entrez votre email pour vous connecter à votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                name="email"
                placeholder="m@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" name="password" required />
            </div>
            {state?.message && state.message !== 'success' && (
              <p className="text-sm text-destructive">{state.message}</p>
            )}
            <LoginButton />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Connexion en cours...' : 'Se connecter'}
    </Button>
  );
}
