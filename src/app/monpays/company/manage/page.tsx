'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { getCompaniesForUser } from '@/lib/actions/monpays.actions';
import type { User, MonPaysCompany } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, PlusCircle, BadgeCheck, FilePenLine, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ManageCompanyPages() {
    const [user, setUser] = useState<User | null>(null);
    const [companies, setCompanies] = useState<MonPaysCompany[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const fetchedUser = await getAuthenticatedUser();
            if (fetchedUser) {
                setUser(fetchedUser);
                const fetchedCompanies = await getCompaniesForUser(fetchedUser.id);
                setCompanies(fetchedCompanies);
            } else {
                router.push('/login');
            }
            setIsLoading(false);
        };
        fetchData();
    }, [router]);

    return (
        <div className="bg-zinc-900 min-h-screen text-white p-4">
             <header className="flex items-center mb-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h1 className="text-xl font-bold ml-2">Gérer mes Pages</h1>
            </header>
             <div className="flex justify-end mb-4">
                 <Button asChild>
                    <Link href="/monpays/create-company">
                        <PlusCircle className="mr-2 h-4 w-4"/> Créer une page
                    </Link>
                </Button>
             </div>

             {isLoading ? (
                 <div className="flex justify-center mt-20"><Loader2 className="h-8 w-8 animate-spin"/></div>
             ) : companies.length > 0 ? (
                 <div className="space-y-4">
                    {companies.map(company => (
                        <Card key={company.id} className="bg-zinc-800 border-zinc-700">
                             <CardContent className="p-4 flex items-center gap-4">
                                <Image src={company.logoUrl || '/logos/logo.png'} alt={company.name} width={64} height={64} className="rounded-lg object-cover bg-zinc-700" />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold">{company.name}</p>
                                        {company.isVerified && <BadgeCheck className="h-5 w-5 text-blue-500"/>}
                                    </div>
                                    <p className="text-xs text-zinc-400">{company.isVerified ? 'Vérifiée' : 'En attente'}</p>
                                </div>
                                {company.isVerified && (
                                    <Button asChild>
                                        <Link href={`/monpays/company/${company.id}/publish`}>
                                            <FilePenLine className="mr-2 h-4 w-4"/>Publier
                                        </Link>
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                 </div>
             ) : (
                 <div className="text-center py-20 text-zinc-400">
                    <p>Vous n'avez encore créé aucune page d'entreprise.</p>
                 </div>
             )}
        </div>
    );
}
