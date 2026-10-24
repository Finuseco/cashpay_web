'use client';

import { useEffect } from 'react';

/** Évite la « page blanche » : toute erreur d'affichage est capturée et on propose de réessayer. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error('[App error]', error);
    }, [error]);

    return (
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Un problème est survenu</h2>
            <p style={{ opacity: 0.7, maxWidth: 420 }}>Cet écran n'a pas pu s'afficher. Vos données sont intactes.</p>
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => reset()} style={{ padding: '8px 16px', borderRadius: 8, background: '#2563eb', color: '#fff' }}>Réessayer</button>
                <button onClick={() => (window.location.href = '/')} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #888' }}>Accueil</button>
            </div>
        </div>
    );
}
