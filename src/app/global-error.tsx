'use client';

/** Dernier filet de sécurité (erreur dans le layout racine) : remplace l'écran blanc par un message. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <html lang="fr">
            <body style={{ fontFamily: 'sans-serif', background: '#0b0f1a', color: '#fff', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', margin: 0 }}>
                <div style={{ textAlign: 'center', padding: 24 }}>
                    <h2>Un problème est survenu</h2>
                    <p style={{ opacity: 0.7 }}>Veuillez réessayer.</p>
                    <button onClick={() => reset()} style={{ padding: '8px 16px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 0 }}>Réessayer</button>
                </div>
            </body>
        </html>
    );
}
