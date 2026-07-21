
// src/app/africoin/send/page.tsx
'use client';
import { AfriCoinHeader } from '../africoin-header';

export default function SendCryptoPage() {
    return (
        <>
            <AfriCoinHeader selectedCurrency="Envoyer" />
            <main className="p-4">
                <h1 className="text-2xl font-bold">Envoyer de la Crypto</h1>
                <p className="text-zinc-400 mt-2">Cette fonctionnalité est en cours de construction.</p>
            </main>
        </>
    );
}
