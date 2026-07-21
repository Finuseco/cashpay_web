
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { AuthCard } from './auth-card';
import { useNotification } from '@/context/notification-context';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import Image from 'next/image';

export function VerifyPinForm() {
  const [pin, setPin] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [loginData, setLoginData] = React.useState<any>(null);
  const router = useRouter();
  const { notify } = useNotification();
  
  React.useEffect(() => {
    const storedData = sessionStorage.getItem('loginAttempt');
    if (!storedData) {
      router.replace('/');
      return;
    }
    setLoginData(JSON.parse(storedData));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpNumber: loginData.cpNumber, pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue.');
      }
      
      sessionStorage.removeItem('loginAttempt');

      // Redirect based on role
      if(data.role === 'Admin' || data.role === 'Manager') {
        router.push('/admin');
      } else if (data.role === 'Agent') {
        router.push('/agent/dashboard');
      } else {
        router.push('/dashboard');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      notify({ title: 'Erreur', description: errorMessage, status: 'error' });
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!loginData) {
    return <div className="flex min-h-screen items-center justify-center bg-background p-4"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <AuthCard
        title="Presque terminé !"
        description={`Entrez votre PIN pour accéder à votre compte.`}
    >
        <div className="flex justify-center mb-6">
            <Image 
                src={loginData.profile_photo_url || '/images/logos/profile-placeholder.png'}
                alt="Photo de profil"
                width={80}
                height={80}
                className="rounded-full object-cover"
            />
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2 text-center">
                <label htmlFor="pin" className="text-sm font-medium">Entrez votre PIN à 4 chiffres</label>
                 <InputOTP 
                    mask 
                    maxLength={4} 
                    value={pin} 
                    onChange={setPin}
                 >
                    <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                    </InputOTPGroup>
                </InputOTP>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || pin.length < 4}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Se Connecter
            </Button>
            
            <Button variant="ghost" className="w-full" onClick={() => router.push('/')}>
                Annuler
            </Button>
        </form>
    </AuthCard>
  );
}
