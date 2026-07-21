
"use client";

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from "react-i18next";
import { Button } from '@/components/ui/button';
import { Phone, Delete, Loader2 } from 'lucide-react';
import { handleUssdRequest } from '@/lib/actions/ussd.actions';

const KeypadButton = ({ main, sub, onClick }: { main: string; sub?: string; onClick: () => void }) => (
    <button onClick={onClick} className="text-center rounded-full transition-colors hover:bg-muted/50 py-0.5">
        <span className="text-sm font-light text-foreground">{main}</span>
        {sub && <span className="text-[0.5rem] tracking-widest text-muted-foreground block">{sub}</span>}
    </button>
);

export function UssdSimulator() {
  const { t } = useTranslation();
  const [ussdInput, setUssdInput] = useState('');
  const [displayText, setDisplayText] = useState('Saisissez *2704# pour lancer CashPay USSD');
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId] = useState(`sim_${Math.random().toString(36).substring(7)}`);
  const [isLoading, setIsLoading] = useState(false);
  const [fullTextPath, setFullTextPath] = useState('');

  const handleKeyClick = (key: string) => {
    setUssdInput(prev => prev + key);
  };

  const handleDelete = () => {
    setUssdInput(prev => prev.slice(0, -1));
  };

  const handleSend = async () => {
    if (!sessionActive) {
      if (ussdInput === '*2704#') {
        setIsLoading(true);
        // On utilise un numéro de test simulé pour le simulateur
        const response = await handleUssdRequest(sessionId, "243853868021", "");
        setDisplayText(response.replace('CON ', '').replace('END ', ''));
        setSessionActive(true);
        setUssdInput('');
        setFullTextPath('');
      } else {
        alert("Code USSD invalide. Essayez *2704#");
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const newPath = fullTextPath === '' ? ussdInput : `${fullTextPath}*${ussdInput}`;
    const response = await handleUssdRequest(sessionId, "243853868021", newPath);
    
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
    setDisplayText('Saisissez *2704# pour lancer CashPay USSD');
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
    <div className="relative w-full max-w-[250px] mx-auto aspect-[9/19.5] drop-shadow-2xl">
      <div className="absolute inset-x-[11px] inset-y-[9px] z-20 flex flex-col rounded-[1.8rem] overflow-hidden bg-background p-1">
        
        <div className="flex-grow flex flex-col justify-end items-center p-2 font-mono text-center pb-2">
            <div className="whitespace-pre-wrap text-sm flex-grow flex items-center overflow-y-auto">
                {isLoading ? <Loader2 className="animate-spin h-6 w-6 text-primary"/> : displayText}
            </div>
             <div className="w-full bg-muted/30 p-1 rounded-md min-h-[30px] flex items-center justify-center">
                <div className="text-base h-5 text-foreground">
                    {ussdInput}
                    {sessionActive && <span className="animate-pulse">|</span>}
                </div>
            </div>
        </div>
        
        <div className="px-1 pb-1">
          <div className="grid grid-cols-3 gap-0.5">
            {keypadLayout.map(key => <KeypadButton key={key.main} {...key} onClick={() => handleKeyClick(key.main)} />)}
          </div>
          <div className="flex justify-between items-center mt-1 px-1">
             <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-red-500" onClick={handleCancel}>
                <Phone className="h-3 w-3 rotate-[135deg]" />
             </Button>
            <Button className="rounded-full h-8 w-8 bg-green-600 hover:bg-green-700" onClick={handleSend} disabled={isLoading}>
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={handleDelete} disabled={ussdInput.length === 0}>
              <Delete className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
      <img src="/images/phone_outline.png" alt="Phone frame" className="absolute inset-0 w-full h-full z-10 pointer-events-none" />
    </div>
  );
}
