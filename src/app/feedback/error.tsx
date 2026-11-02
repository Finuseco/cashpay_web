'use client';
import {OnChatLogo} from '@/components/feedback/on-chat-logo';
export default function OnChatError({reset}:{reset:()=>void}){return <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-5 p-6"><OnChatLogo/><h1 className="text-xl font-bold">OnChat n’a pas pu charger cette page.</h1><p>Vérifiez votre connexion et réessayez.</p><button onClick={reset} className="bg-violet-600 rounded-xl px-5 py-3">Réessayer</button><a href="/feedback" className="text-cyan-300">Retour aux discussions</a></main>;}
