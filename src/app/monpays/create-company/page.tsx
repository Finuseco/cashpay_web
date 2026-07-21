
'use client';

import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { CreateCompanyForm } from '@/components/monpays/create-company-form';

function CreateCompanyClient() {

  return (
    <div className="p-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
            <Button asChild variant="ghost" size="icon">
                <Link href="/monpays/dashboard">
                    <ArrowLeft />
                </Link>
            </Button>
            <h1 className="text-xl font-bold">Enregistrer une Entreprise</h1>
        </div>
      
        <Card className="bg-zinc-800 border-zinc-700 text-white">
            <CardHeader>
                <CardTitle>Formulaire de Création</CardTitle>
                <CardDescription>
                    Remplissez les informations légales et de contact de votre entreprise. Votre demande sera soumise pour vérification. Un paiement unique de 30 USD est requis.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <CreateCompanyForm />
            </CardContent>
        </Card>
    </div>
  );
}

export default function CreateCompanyPage() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <CreateCompanyClient />
        </Suspense>
    );
}
