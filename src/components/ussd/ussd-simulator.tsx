
"use client";

import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { Button } from '@/components/ui/button';
import { Phone, Delete, Loader2, User as UserIcon, ShieldCheck } from 'lucide-react';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const KeypadButton = ({ main, sub, onClick }: { main: string; sub?: string; onClick: () => void }) => (
    <button onClick={onClick} className="text-center rounded-full transition-colors hover:bg-muted/50 py-1">
        <span className="text-sm font-light text-foreground">{main}</span>
        {sub && <span className="text-[0.5rem] tracking-widest text-muted-foreground block">{sub}</span>}
    </button>
);

export function UssdSimulator() {
  const { t } = useTranslation();
  const [ussdInput, setUssdInput] = useState('');
  const [displayText, setDisplayText] = useState('Saisissez *2704# Services CashPay All via USSD ');
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId] = useState(`sim_${Math.random().toString(36).substring(7)}`);
  const [isLoading, setIsLoading] = useState(false);
  const [fullTextPath, setFullTextPath] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  useEffect(() => {
    getAuthenticatedUser().then(user => {
        setCurrentUser(user);
        setHasCheckedAuth(true);
    });
  }, []);

  const handleKeyClick = (key: string) => {
    setUssdInput(prev => prev + key);
  };

  const handleDelete = () => {
    setUssdInput(prev => prev.slice(0, -1));
  };

  const handleSend = async () => {
    // Si l'utilisateur est connecté, on utilise son numéro.
    // Sinon, on utilise un numéro "Anonyme" pour forcer le parcours d'inscription.
    const simulatorMsisdn = currentUser?.phone || "00000000000";

    if (!sessionActive) {
      if (ussdInput === '*2704#') {
        setIsLoading(true);
        const response = await fetch('/api/ussd/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            sessionId,
            phoneNumber: simulatorMsisdn,
            text: '',
          }),
        }).then((r) => r.text());
        setDisplayText(response.replace('CON ', '').replace('END ', ''));
        setSessionActive(true);
        setUssdInput('');
        setFullTextPath('');
      } else {
        alert("Code USSD inconnu. Essayez *2704# pour CashPay.");
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const newPath = fullTextPath === '' ? ussdInput : `${fullTextPath}*${ussdInput}`;
    const response = await fetch('/api/ussd/callback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        sessionId,
        phoneNumber: simulatorMsisdn,
        text: newPath,
      }),
    }).then((r) => r.text());
    
    setDisplayText(response.replace('CON ', '').replace('END ', ''));
    setFullTextPath(newPath);
    setUssdInput('');

    if (response.startsWith('END')) {
      setSessionActive(false);
      setFullTextPath('');
    }
    setIsLoading(false);
  };

  const handleCancel = () => {
    setSessionActive(false);
    setDisplayText('Saisissez *2704# pour tester le moteur USSD Souverain');
    setUssdInput('');
    setFullTextPath('');
  };

  const keypadLayout = [
    { main: '1', sub: ' ' }, { main: '2', sub: 'ABC' }, { main: '3', sub: 'DEF' },
    { main: '4', sub: 'GHI' }, { main: '5', sub: 'JKL' }, { main: '6', sub: 'MNO' },
    { main: '7', sub: 'PQRS' }, { main: '8', sub: 'TUV' }, { main: '9', sub: 'WXYZ' },
    { main: '*', sub: '' }, { main: '0', sub: '+' }, { main: '#', sub: '' }
  ];

  return (
    <div className="flex flex-col items-center gap-8">
        {hasCheckedAuth && (
            <div className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-4">
                {currentUser ? (
                    <>
                        <Avatar className="h-10 w-10 border border-primary shadow-lg">
                            <AvatarImage src={currentUser.profile_photo || ''}/>
                            <AvatarFallback className="bg-primary/20 text-primary font-black">{currentUser.first_name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="text-[10px] font-black uppercase text-primary tracking-widest leading-none">Sim. Membre</p>
                            <p className="text-sm font-bold text-white">+{currentUser.phone}</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="h-10 w-10 rounded-full bg-zinc-700 flex items-center justify-center border-2 border-dashed border-zinc-500">
                            <UserIcon className="h-5 w-5 text-zinc-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest leading-none">Sim. Anonyme</p>
                            <p className="text-sm font-bold text-zinc-400 italic">Pas de session détectée</p>
                        </div>
                    </>
                )}
            </div>
        )}

        <div className="relative w-full max-w-[250px] mx-auto aspect-[9/19.5] drop-shadow-2xl">
        <div className="absolute inset-x-[11px] inset-y-[9px] z-20 flex flex-col rounded-[1.8rem] overflow-hidden bg-background p-1 border-4 border-black">
            
            <div className="flex-grow flex flex-col justify-end items-center p-3 font-mono text-center pb-4">
                <div className="whitespace-pre-wrap text-xs flex-grow flex items-center overflow-y-auto leading-tight text-foreground font-bold">
                    {isLoading ? <Loader2 className="animate-spin h-6 w-6 text-primary mx-auto"/> : displayText}
                </div>
                <div className="w-full bg-muted/40 p-2 rounded-lg min-h-[40px] flex items-center justify-center mt-3 border border-zinc-100">
                    <div className="text-lg h-6 text-foreground font-black tracking-widest">
                        {ussdInput}
                        {sessionActive && <span className="animate-pulse text-primary">|</span>}
                    </div>
                </div>
            </div>
            
            <div className="px-1 pb-2">
            <div className="grid grid-cols-3 gap-0.5">
                {keypadLayout.map(key => <KeypadButton key={key.main} {...key} onClick={() => handleKeyClick(key.main)} />)}
            </div>
            <div className="flex justify-between items-center mt-2 px-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50" onClick={handleCancel}>
                    <Phone className="h-4 w-4 rotate-[135deg]" />
                </Button>
                <Button className="rounded-full h-10 w-10 bg-green-600 hover:bg-green-700 shadow-xl scale-110" onClick={handleSend} disabled={isLoading}>
                <Phone className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-400 hover:bg-zinc-100" onClick={handleDelete} disabled={ussdInput.length === 0}>
                <Delete className="h-4 w-4" />
                </Button>
            </div>
            </div>
        </div>
        <img src="/images/phone_outline.png" alt="" className="absolute inset-0 w-full h-full z-10 pointer-events-none opacity-40" />
        </div>
        
        <div className="text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-zinc-500">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-[10px] font-black uppercase tracking-widest">Souveraineté USSD Active</p>
            </div>
            <p className="text-[9px] text-zinc-600 italic max-w-[220px]">
                {!currentUser ? "Inscrivez-vous directement depuis le simulateur." : "Votre identité est liée au numéro de carte SIM identifié."}
            </p>
        </div>
    </div>
  );
}

