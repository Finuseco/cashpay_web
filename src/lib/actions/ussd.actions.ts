'use server';

/**
 * @fileOverview Moteur USSD Souverain CashPay v2.2.
 * Gère la logique multi-pays, le réabonnement TV, le changement de langue,
 * et les flux financiers (PayIn/PayOut) via MaxiCash.
 */

import { getUserFromDb } from '@/lib/actions/helpers';
import type { User } from '@/lib/types';
import { createTransaction, getUserTransactions } from '@/lib/actions/transaction.actions';
import { verifyUserPin, updatePin, updateUser } from '@/lib/actions/auth.actions';
import { getUserCurrencies } from '@/lib/actions/currency.actions';
import { processMaxiCashMobilePayment, processMaxiCashPayout } from '@/services/maxicash';
import { countryToCode } from '@/lib/utils';
import { getCardsForUser, toggleCardStatus, purchaseCard } from './card.actions';

// Cache des sessions en mémoire
const userSessions = new Map<string, { menuState: string, data: any }>();

type UssdHandler = (user: User, text: string, session: { menuState: string, data: any }) => Promise<string>;

// Référentiel des opérateurs par pays pour USSD
const OPERATORS_BY_COUNTRY: Record<string, {id: string, name: string}[]> = {
    'CD': [
        { id: 'mpesa', name: 'M-Pesa' },
        { id: 'airtel', name: 'Airtel Money' },
        { id: 'orange', name: 'Orange Money' },
        { id: 'afrimoney', name: 'Afrimoney' }
    ],
    'CG': [{ id: 'mtn', name: 'MTN MoMo' }, { id: 'airtel', name: 'Airtel Money' }],
    'SN': [{ id: 'orange', name: 'Orange Money' }, { id: 'free', name: 'Free Money' }],
    'CI': [{ id: 'orange', name: 'Orange' }, { id: 'mtn', name: 'MTN' }, { id: 'moov', name: 'Moov' }]
};

const TV_PROVIDERS = [
    { id: 'canal_plus', name: 'Canal+' },
    { id: 'startimes', name: 'StarTimes' },
    { id: 'easytv', name: 'EasyTV' }
];

const TV_BOUQUETS: Record<string, {id: string, name: string, price: number}[]> = {
    'canal_plus': [{ id: 'acc', name: 'Access', price: 10 }, { id: 'evas', name: 'Evasion', price: 20 }],
    'startimes': [{ id: 'basic', name: 'Basic', price: 8 }, { id: 'smart', name: 'Smart', price: 15 }],
    'easytv': [{ id: 'unique', name: 'Unique', price: 12 }]
};

/**
 * Traduction basique pour le moteur USSD (Français/Anglais).
 */
const translate = (key: string, lang: string) => {
    const dictionary: Record<string, Record<string, string>> = {
        'fr': {
            'root': 'CashPay\n1. Soldes\n2. Transfert\n3. Retrait\n4. Recharger\n5. TV\n6. Cartes\n7. Historique\n8. Paramètres',
            'balance': 'Vos soldes CashPay :\n',
            'amount': 'Entrez le montant :',
            'pin': 'Entrez votre PIN :',
            'success': 'Opération réussie !',
            'error': 'Une erreur est survenue.'
        },
        'en': {
            'root': 'CashPay\n1. Balances\n2. Transfer\n3. Withdraw\n4. Top-up\n5. TV\n6. Cards\n7. History\n8. Settings',
            'balance': 'Your CashPay balances:\n',
            'amount': 'Enter amount:',
            'pin': 'Enter your PIN:',
            'success': 'Success!',
            'error': 'An error occurred.'
        }
    };
    return dictionary[lang]?.[key] || dictionary['fr'][key];
};

/**
 * Formate les soldes pour l'affichage USSD.
 */
async function formatAllBalances(userId: number): Promise<string> {
    const currencies = await getUserCurrencies(userId);
    return currencies.map(c => `${c.code}: ${c.balance}`).join('\n');
}

const menuHandlers: Record<string, UssdHandler> = {
    'ROOT': async (user) => {
        return `CON ${translate('root', user.language)}`;
    },

    // --- 1. SOLDES ---
    'BALANCE_SHOW': async (user) => {
        const balances = await formatAllBalances(user.id);
        return `END ${translate('balance', user.language)}\n${balances}`;
    },

    // --- 2. TRANSFERT ---
    'TRANSFER_RECIPIENT': async () => {
        return `CON Entrez l'ID Portefeuille destinataire :`;
    },
    'TRANSFER_AMOUNT': async (user, text, session) => {
        const recipient = await getUserFromDb({ walletId: text.toUpperCase() });
        if (!recipient) return `END Utilisateur introuvable.`;
        session.data.recipient = recipient;
        return `CON Montant pour ${recipient.full_name} (USD) :`;
    },
    'TRANSFER_PIN': async (user, text, session) => {
        session.data.amount = parseFloat(text);
        return `CON ${translate('pin', user.language)}`;
    },
    'TRANSFER_CONFIRM': async (user, text, session) => {
        const pinRes = await verifyUserPin(user.id, text);
        if (!pinRes.success) return `END PIN incorrect.`;
        
        const res = await createTransaction({
            user, typeCode: 'TR', amount: session.data.amount, currency: 'USD',
            description: `Transfert USSD vers ${session.data.recipient.full_name}`,
            receiver_id: session.data.recipient.id
        });

        const balances = await formatAllBalances(user.id);
        return res.success ? `END ${translate('success', user.language)}\nSoldes: ${balances}` : `END ${res.error}`;
    },

    // --- 3. RETRAIT (PAYOUT) ---
    'PAYOUT_TYPE': async () => {
        return `CON Retirer vers :\n1. Mon numéro lié\n2. Un autre numéro`;
    },
    'PAYOUT_OPERATOR': async (user, text, session) => {
        if (text === '1') session.data.recipientPhone = user.phone;
        const code = countryToCode(user.country) || 'CD';
        const ops = OPERATORS_BY_COUNTRY[code] || OPERATORS_BY_COUNTRY['CD'];
        let menu = "CON Opérateur :\n";
        ops.forEach((op, i) => menu += `${i+1}. ${op.name}\n`);
        return menu;
    },
    'PAYOUT_NUMBER': async (user, text, session) => {
        const code = countryToCode(user.country) || 'CD';
        const ops = OPERATORS_BY_COUNTRY[code] || OPERATORS_BY_COUNTRY['CD'];
        session.data.operator = ops[parseInt(text) - 1]?.id;
        if (!session.data.operator) return "END Opérateur invalide.";
        return session.data.recipientPhone ? `CON Montant à retirer (USD) :` : `CON Numéro de destination :`;
    },
    'PAYOUT_AMOUNT': async (user, text, session) => {
        if (!session.data.recipientPhone) session.data.recipientPhone = text;
        return `CON Montant à retirer (USD) :`;
    },
    'PAYOUT_PIN': async (user, text, session) => {
        session.data.amount = parseFloat(text);
        return `CON ${translate('pin', user.language)}`;
    },
    'PAYOUT_CONFIRM': async (user, text, session) => {
        const pinRes = await verifyUserPin(user.id, text);
        if (!pinRes.success) return `END PIN incorrect.`;

        const res = await processMaxiCashPayout({
            amount: session.data.amount, currency: 'USD', recipientPhone: session.data.recipientPhone,
            operator: session.data.operator, countryCode: countryToCode(user.country) || 'CD',
            reference: `US_WD_${Date.now()}`, beneficiaryName: `Retrait ${user.full_name}`, user
        });
        
        const balances = await formatAllBalances(user.id);
        return res.success ? `END Retrait réussi.\nNouveaux soldes:\n${balances}` : `END Échec: ${res.message}`;
    },

    // --- 4. RECHARGER (PAYIN) ---
    'DEPOSIT_OPERATOR': async (user) => {
        const code = countryToCode(user.country) || 'CD';
        const ops = OPERATORS_BY_COUNTRY[code] || OPERATORS_BY_COUNTRY['CD'];
        let menu = "CON Recharger mon compte via :\n";
        ops.forEach((op, i) => menu += `${i+1}. ${op.name}\n`);
        return menu;
    },
    'DEPOSIT_AMOUNT': async (user, text, session) => {
        const code = countryToCode(user.country) || 'CD';
        const ops = OPERATORS_BY_COUNTRY[code] || OPERATORS_BY_COUNTRY['CD'];
        session.data.operator = ops[parseInt(text) - 1]?.id;
        return `CON Montant de recharge (USD) :`;
    },
    'DEPOSIT_CONFIRM': async (user, text, session) => {
        const amount = parseFloat(text);
        const res = await processMaxiCashMobilePayment({
            amount, currency: 'USD', phoneNumber: user.phone!,
            operator: session.data.operator, reference: `US_DP_${Date.now()}`,
            countryCode: countryToCode(user.country) || 'CD', user
        });
        return res.success ? `END Demande envoyée à votre téléphone. Validez avec votre PIN mobile.` : `END Erreur réseau.`;
    },

    // --- 5. TV (RÉABONNEMENT) ---
    'TV_MENU': async () => {
        let menu = "CON Réabonnement TV :\n";
        TV_PROVIDERS.forEach((p, i) => menu += `${i+1}. ${p.name}\n`);
        return menu;
    },
    'TV_SMARTCARD': async (user, text, session) => {
        session.data.provider = TV_PROVIDERS[parseInt(text)-1];
        if (!session.data.provider) return "END Fournisseur invalide.";
        return `CON Entrez votre n° de décodeur :`;
    },
    'TV_BOUQUET': async (user, text, session) => {
        session.data.smartcard = text;
        const bouquets = TV_BOUQUETS[session.data.provider.id];
        let menu = "CON Choisissez votre bouquet :\n";
        bouquets.forEach((b, i) => menu += `${i+1}. ${b.name} ($${b.price})\n`);
        return menu;
    },
    'TV_PIN': async (user, text, session) => {
        const bouquets = TV_BOUQUETS[session.data.provider.id];
        session.data.bouquet = bouquets[parseInt(text)-1];
        if (!session.data.bouquet) return "END Bouquet invalide.";
        return `CON PIN CashPay pour confirmer $${session.data.bouquet.price} :`;
    },
    'TV_CONFIRM': async (user, text, session) => {
        const pinRes = await verifyUserPin(user.id, text);
        if (!pinRes.success) return "END PIN incorrect.";

        const res = await createTransaction({
            user, typeCode: 'TV', amount: session.data.bouquet.price, currency: 'USD',
            description: `Réabonnement ${session.data.provider.name} - ${session.data.bouquet.name}`,
            metadata: { smartcard: session.data.smartcard }
        });

        return res.success ? `END Félicitations ! Votre abonnement ${session.data.provider.name} est renouvelé.` : `END Solde insuffisant.`;
    },

    // --- 6. CARTES ---
    'CARD_MENU': async () => {
        return `CON Gestion des Cartes :\n1. Acheter Carte Virtuelle\n2. Bloquer Carte`;
    },

    // --- 7. HISTORIQUE ---
    'HISTORY_SHOW': async (user) => {
        const txs = await getUserTransactions(user.id, 3);
        let menu = "END Vos dernières opérations :\n";
        txs.forEach(t => menu += `${t.date}: ${t.type === 'sent' ? '-' : '+'}${t.amount} ${t.currency}\n`);
        return menu;
    },

    // --- 8. PARAMÈTRES (LANGUE, PIN) ---
    'SETTINGS_MENU': async () => {
        return `CON Paramètres :\n1. Changer la Langue\n2. Changer mon PIN\n3. Mon Profil`;
    },
    'LANG_SELECT': async () => {
        return `CON Choisir la langue :\n1. Français\n2. English`;
    },
    'LANG_CONFIRM': async (user, text) => {
        const newLang = text === '2' ? 'en' : 'fr';
        await updateUser({ userId: user.id, updates: { language: newLang } as any });
        return `END ${newLang === 'en' ? 'Language updated to English.' : 'Langue modifiée en Français.'}`;
    }
};

export async function handleUssdRequest(sessionId: string, phoneNumber: string, text: string): Promise<string> {
    try {
        const sanitizedPhone = phoneNumber.replace('+', '').trim();
        const user = await getUserFromDb({ phoneNumber: sanitizedPhone });
        
        if (!user) return "END Numéro non reconnu. Inscrivez-vous sur l'application CashPay.";

        const parts = text.split('*');
        const lastInput = parts[parts.length - 1] || '';
        
        let session = userSessions.get(sessionId);
        if (!session) {
            session = { menuState: 'ROOT', data: {} };
            userSessions.set(sessionId, session);
        }
        
        let nextState: string = session.menuState;

        if (text === '') nextState = 'ROOT';
        else if (session.menuState === 'ROOT') {
            const map: Record<string, string> = {
                '1': 'BALANCE_SHOW', '2': 'TRANSFER_RECIPIENT', '3': 'PAYOUT_TYPE',
                '4': 'DEPOSIT_OPERATOR', '5': 'TV_MENU', '6': 'CARD_MENU',
                '7': 'HISTORY_SHOW', '8': 'SETTINGS_MENU'
            };
            nextState = map[lastInput] || 'ROOT';
        } 
        // Transitions TV
        else if (session.menuState === 'TV_MENU') nextState = 'TV_SMARTCARD';
        else if (session.menuState === 'TV_SMARTCARD') nextState = 'TV_BOUQUET';
        else if (session.menuState === 'TV_BOUQUET') nextState = 'TV_PIN';
        else if (session.menuState === 'TV_PIN') nextState = 'TV_CONFIRM';
        // Transitions Transfert
        else if (session.menuState === 'TRANSFER_RECIPIENT') nextState = 'TRANSFER_AMOUNT';
        else if (session.menuState === 'TRANSFER_AMOUNT') nextState = 'TRANSFER_PIN';
        else if (session.menuState === 'TRANSFER_PIN') nextState = 'TRANSFER_CONFIRM';
        // Transitions Retrait
        else if (session.menuState === 'PAYOUT_TYPE') nextState = 'PAYOUT_OPERATOR';
        else if (session.menuState === 'PAYOUT_OPERATOR') nextState = 'PAYOUT_NUMBER';
        else if (session.menuState === 'PAYOUT_NUMBER') nextState = 'PAYOUT_AMOUNT';
        else if (session.menuState === 'PAYOUT_AMOUNT') nextState = 'PAYOUT_PIN';
        else if (session.menuState === 'PAYOUT_PIN') nextState = 'PAYOUT_CONFIRM';
        // Transitions Dépôt
        else if (session.menuState === 'DEPOSIT_OPERATOR') nextState = 'DEPOSIT_AMOUNT';
        else if (session.menuState === 'DEPOSIT_AMOUNT') nextState = 'DEPOSIT_CONFIRM';
        // Transitions Paramètres
        else if (session.menuState === 'SETTINGS_MENU') {
            if (lastInput === '1') nextState = 'LANG_SELECT';
            else if (lastInput === '3') nextState = 'PROFILE_SHOW';
        }
        else if (session.menuState === 'LANG_SELECT') nextState = 'LANG_CONFIRM';

        const handler = menuHandlers[nextState];
        if (handler) {
            const response = await handler(user, lastInput, session);
            session.menuState = nextState;
            if (response.startsWith('END')) userSessions.delete(sessionId);
            return response;
        }
        
        return 'END Session expirée.';

    } catch (error) {
        return "END Erreur système. Veuillez réessayer.";
    }
}
