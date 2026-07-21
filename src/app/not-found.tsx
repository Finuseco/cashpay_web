
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Cookies from 'js-cookie';
import { Button } from '@/components/ui/button';
import { Home, LogIn, Frown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Logo } from '@/components/logo';

export default function NotFoundPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = Cookies.get('cashpay-token');
    setIsLoggedIn(!!token);
    setIsLoading(false);
  }, []);

  return (
    <main className="flex items-center justify-center min-h-screen bg-muted/50 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto bg-destructive/10 text-destructive rounded-full h-16 w-16 flex items-center justify-center mb-4">
            <Frown className="h-8 w-8" />
          </div>
          <CardTitle className="text-4xl font-bold">404</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Oups ! La page que vous cherchez n'existe pas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            Il se peut que le lien soit incorrect ou que la page ait été déplacée.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          {isLoading ? (
            <Button disabled className="w-full">
              Chargement...
            </Button>
          ) : isLoggedIn ? (
            <Button asChild className="w-full" variant="gradient">
              <Link href="/dashboard">
                <Home className="mr-2 h-4 w-4" />
                Retour au Tableau de Bord
              </Link>
            </Button>
          ) : (
            <Button asChild className="w-full" variant="gradient">
              <Link href="/login">
                <LogIn className="mr-2 h-4 w-4" />
                Retour à la Connexion
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
