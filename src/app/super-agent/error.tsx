'use client';
export default function ManagementError({reset}:{reset:()=>void}){
 return <section className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-6 text-center"><h1 className="text-xl font-bold">Ce service n’a pas pu être chargé.</h1><p>Vérifiez votre session et les migrations de la base. Une erreur ne confirme aucune opération financière.</p><button className="rounded-xl bg-violet-700 text-white px-5 py-3" onClick={reset}>Réessayer</button><a href="/super-agent/dashboard" className="underline">Retour au tableau de bord</a></section>;
}
