'use server';

/**
 * @fileoverview CloudMax — Actions domaines et hébergement.
 * Registrar : eNom (ENOM_USERNAME / ENOM_TOKEN dans .env)
 * Stockage   : table `cloudmax_domains` + `cloudmax_dns_records` + `cloudmax_hosting_accounts`
 */

import { db } from '@/lib/db';
import type { User } from '../types';
import { createTransaction } from './transaction.actions';
import { getAuthenticatedUser } from './user.actions';

// ─── Init tables (appelé au premier usage) ────────────────────────────────────

async function ensureTables() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS cloudmax_domains (
            id              SERIAL PRIMARY KEY,
            user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            domain_name     VARCHAR(253) NOT NULL UNIQUE,
            registrar       VARCHAR(50) DEFAULT 'enom',
            status          VARCHAR(20) DEFAULT 'active',  -- active | expiring | expired | pending | transferring
            registered_at   TIMESTAMPTZ DEFAULT NOW(),
            expires_at      TIMESTAMPTZ,
            auto_renew      BOOLEAN DEFAULT FALSE,
            registrar_lock  BOOLEAN DEFAULT TRUE,
            nameservers     TEXT[] DEFAULT ARRAY['ns1.cashpay.africa','ns2.cashpay.africa'],
            created_at      TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS cloudmax_dns_records (
            id          SERIAL PRIMARY KEY,
            domain_id   INTEGER NOT NULL REFERENCES cloudmax_domains(id) ON DELETE CASCADE,
            type        VARCHAR(10) NOT NULL,  -- A AAAA CNAME MX TXT NS SRV
            name        VARCHAR(255) NOT NULL,
            value       TEXT NOT NULL,
            ttl         INTEGER DEFAULT 3600,
            priority    INTEGER DEFAULT 0,
            created_at  TIMESTAMPTZ DEFAULT NOW(),
            updated_at  TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS cloudmax_hosting_accounts (
            id              SERIAL PRIMARY KEY,
            user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            domain_id       INTEGER REFERENCES cloudmax_domains(id),
            plan            VARCHAR(50) NOT NULL,  -- starter | pro | unlimited
            storage_gb      INTEGER,               -- NULL = illimité
            status          VARCHAR(20) DEFAULT 'active',
            vps_host        VARCHAR(255),          -- IP/host du serveur VPS attribué
            username        VARCHAR(100),          -- identifiant cPanel/panel distant
            password_hash   TEXT,
            starts_at       TIMESTAMPTZ DEFAULT NOW(),
            expires_at      TIMESTAMPTZ,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        );
    `);
}

// ─── Helpers eNom ──────────────────────────────────────────────────────────────

function enom() {
    return { uid: process.env.ENOM_USERNAME || '', token: process.env.ENOM_TOKEN || '' };
}
function hasEnom() {
    const { uid, token } = enom();
    return uid && token && !uid.includes('YOUR_') && !token.includes('YOUR_');
}
function splitDomain(domain: string) {
    const parts = domain.toLowerCase().trim().split('.');
    if (parts.length < 2) return null;
    return { sld: parts.slice(0, -1).join('.'), tld: parts.slice(-1)[0] };
}
async function enomGet(command: string, extra: Record<string, string> = {}) {
    const { uid, token } = enom();
    const params = new URLSearchParams({ command, uid, pw: token, ResponseType: 'XML', ...extra });
    const res = await fetch(`https://reseller.enom.com/interface.asp?${params}`, { cache: 'no-store' });
    return res.text();
}

// ─── Disponibilité ─────────────────────────────────────────────────────────────

export async function checkDomainAvailability(domain: string): Promise<{ available: boolean }> {
    const parts = splitDomain(domain);
    if (!parts) return { available: false };
    if (!hasEnom()) {
        const taken = ['google','facebook','cashpay','finuseco','amazon','microsoft'];
        return { available: !taken.some(d => domain.toLowerCase().includes(d)) };
    }
    try {
        const xml = await enomGet('check', { sld: parts.sld, tld: parts.tld });
        const code = xml.match(/<RRPCode>(\d+)<\/RRPCode>/)?.[1];
        return { available: code === '210' };
    } catch {
        return { available: false };
    }
}

// ─── Achat domaine ─────────────────────────────────────────────────────────────

export async function addDomainToCart(domain: string, years: number, user: User): Promise<{ success: boolean; error?: string }> {
    const parts = splitDomain(domain);
    if (!parts) return { success: false, error: 'Format de domaine invalide.' };
    if (!hasEnom()) return { success: false, error: 'Registrar non configuré.' };
    try {
        const params: Record<string, string> = {
            Command: 'AddToCart', ProductType: 'register',
            TLD: parts.tld, SLD: parts.sld, Quantity: String(years),
        };
        const contacts = ['Registrant','Admin','Tech','AuxBilling'];
        for (const c of contacts) {
            Object.assign(params, {
                [`${c}FirstName`]: user.first_name || 'Prénom',
                [`${c}LastName`]:  user.last_name  || 'Nom',
                [`${c}Address1`]:  user.address    || '123 Avenue',
                [`${c}City`]:      user.city       || 'Kinshasa',
                [`${c}StateProvince`]: 'Kinshasa',
                [`${c}PostalCode`]: '00243',
                [`${c}Country`]:   user.country    || 'CD',
                [`${c}Phone`]:     user.phone ? `+${user.phone}` : '+243853868021',
                [`${c}EmailAddress`]: user.email || 'contact@cashpay.cd',
            });
        }
        const xml = await enomGet('AddToCart', params);
        if (xml.includes('<Done>true</Done>')) return { success: true };
        const err = xml.match(/<Err1>(.*?)<\/Err1>/)?.[1] || 'Erreur panier.';
        return { success: false, error: err };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function purchaseDomain(
    user: User, domain: string, years: number, price: number
): Promise<{ success: boolean; error?: string }> {
    if (!hasEnom()) return { success: false, error: 'Registrar non configuré.' };
    const tx = await createTransaction({
        user, typeCode: 'DOMAIN_BUY', amount: price, currency: 'USD',
        description: `Domaine ${domain} — ${years} an(s)`,
        metadata: { domain, years }
    });
    if (!tx.success) return { success: false, error: tx.error || 'Paiement échoué.' };

    try {
        const xml = await enomGet('Purchase');
        if (!xml.includes('<Done>true</Done>')) {
            const err = xml.match(/<Err1>(.*?)<\/Err1>/)?.[1] || 'Achat eNom échoué.';
            return { success: false, error: err };
        }
    } catch (e: any) {
        return { success: false, error: e.message };
    }

    // Persister en base
    try {
        await ensureTables();
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + years);
        await db.query(
            `INSERT INTO cloudmax_domains (user_id, domain_name, registrar, status, expires_at)
             VALUES ($1, $2, 'enom', 'active', $3)
             ON CONFLICT (domain_name) DO UPDATE SET expires_at=$3, status='active'`,
            [user.id, domain.toLowerCase(), expires]
        );
        // DNS par défaut
        const { rows } = await db.query(
            `SELECT id FROM cloudmax_domains WHERE domain_name=$1 LIMIT 1`, [domain.toLowerCase()]
        );
        if (rows[0]) {
            await db.query(
                `INSERT INTO cloudmax_dns_records (domain_id, type, name, value)
                 VALUES ($1,'A','@','0.0.0.0'), ($1,'CNAME','www','${domain}')
                 ON CONFLICT DO NOTHING`,
                [rows[0].id]
            );
        }
    } catch (e) { console.error('[domain.actions] DB save error', e); }

    return { success: true };
}

// ─── Liste domaines utilisateur ────────────────────────────────────────────────

export async function getDomainsForUser(userId: number) {
    try {
        await ensureTables();
        const { rows } = await db.query(
            `SELECT domain_name AS name,
                    expires_at  AS expires,
                    CASE
                        WHEN expires_at < NOW() THEN 'expired'
                        WHEN expires_at < NOW() + INTERVAL '30 days' THEN 'expiring'
                        ELSE 'active'
                    END AS status
             FROM cloudmax_domains
             WHERE user_id=$1
             ORDER BY created_at DESC`,
            [userId]
        );
        return { success: true, data: rows };
    } catch (e: any) {
        return { success: false, error: e.message, data: [] };
    }
}

// ─── Info domaine + DNS ─────────────────────────────────────────────────────────

export async function getDomainInfo(domainName: string) {
    try {
        await ensureTables();
        const user = await getAuthenticatedUser();
        if (!user) return { success: false };
        const { rows } = await db.query(
            `SELECT d.*, array_agg(row_to_json(r)) FILTER (WHERE r.id IS NOT NULL) AS dns_records
             FROM cloudmax_domains d
             LEFT JOIN cloudmax_dns_records r ON r.domain_id = d.id
             WHERE d.domain_name=$1 AND d.user_id=$2
             GROUP BY d.id`,
            [domainName.toLowerCase(), user.id]
        );
        if (!rows[0]) {
            // Domaine non encore en DB (acheté avant la nouvelle version) — créer un enregistrement minimal
            await db.query(
                `INSERT INTO cloudmax_domains (user_id, domain_name, status, expires_at)
                 VALUES ($1,$2,'active', NOW() + INTERVAL '1 year')
                 ON CONFLICT DO NOTHING`,
                [user.id, domainName.toLowerCase()]
            );
            return getDomainInfo(domainName);
        }
        const d = rows[0];
        return {
            success: true,
            data: {
                id: d.id,
                domainName: d.domain_name,
                status: d.status,
                registrarLock: d.registrar_lock,
                autoRenew: d.auto_renew,
                expires: d.expires_at,
                nameservers: d.nameservers || ['ns1.cashpay.africa','ns2.cashpay.africa'],
                dnsRecords: (d.dns_records || []).map((r: any) => ({
                    id: r.id, type: r.type, name: r.name, value: r.value, ttl: r.ttl, priority: r.priority
                })),
            }
        };
    } catch (e: any) {
        console.error('[getDomainInfo]', e.message);
        return { success: false };
    }
}

// ─── DNS ───────────────────────────────────────────────────────────────────────

export async function updateDnsRecords(domainName: string, records: any[]) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return { success: false, error: 'Non authentifié.' };
        const { rows } = await db.query(
            `SELECT id FROM cloudmax_domains WHERE domain_name=$1 AND user_id=$2`,
            [domainName.toLowerCase(), user.id]
        );
        if (!rows[0]) return { success: false, error: 'Domaine introuvable.' };
        const domainId = rows[0].id;
        // Remplacer tous les enregistrements
        await db.query(`DELETE FROM cloudmax_dns_records WHERE domain_id=$1`, [domainId]);
        for (const r of records) {
            await db.query(
                `INSERT INTO cloudmax_dns_records (domain_id,type,name,value,ttl,priority)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [domainId, r.type, r.name || '@', r.value, r.ttl || 3600, r.priority || 0]
            );
        }
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ─── Nameservers ────────────────────────────────────────────────────────────────

export async function updateNameservers(domainName: string, ns: string[]) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return { success: false, error: 'Non authentifié.' };
        await db.query(
            `UPDATE cloudmax_domains SET nameservers=$1 WHERE domain_name=$2 AND user_id=$3`,
            [ns, domainName.toLowerCase(), user.id]
        );
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ─── Registrar lock ────────────────────────────────────────────────────────────

export async function setRegistrarLock(domainName: string, locked: boolean) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return { success: false };
        await db.query(
            `UPDATE cloudmax_domains SET registrar_lock=$1 WHERE domain_name=$2 AND user_id=$3`,
            [locked, domainName.toLowerCase(), user.id]
        );
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ─── Auto-renew ────────────────────────────────────────────────────────────────

export async function setAutoRenew(domainName: string, enabled: boolean) {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return { success: false };
        await db.query(
            `UPDATE cloudmax_domains SET auto_renew=$1 WHERE domain_name=$2 AND user_id=$3`,
            [enabled, domainName.toLowerCase(), user.id]
        );
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ─── SSL (stub connecté à une vraie transaction) ───────────────────────────────

export async function purchaseSslCertificate(domainName: string, type: 'Standard' | 'Wildcard') {
    try {
        const user = await getAuthenticatedUser();
        if (!user) return { success: false, error: 'Non authentifié.' };
        const price = type === 'Wildcard' ? 75 : 10;
        const tx = await createTransaction({
            user, typeCode: 'SSL_BUY', amount: price, currency: 'USD',
            description: `SSL ${type} pour ${domainName}`,
            metadata: { domain: domainName, sslType: type }
        });
        return tx.success ? { success: true } : { success: false, error: tx.error };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ─── Redirection ───────────────────────────────────────────────────────────────

export async function setDomainForwarding(domain: string, destination: string) {
    if (!destination.startsWith('http')) return { success: false, error: 'URL de destination invalide.' };
    // Stocker comme enregistrement DNS CNAME ou URL redirect — on note dans la table
    return updateDnsRecords(domain, [{ type: 'URL', name: '@', value: destination, ttl: 300 }]);
}

// ─── EPP Code ─────────────────────────────────────────────────────────────────

export async function getEppCode(domainName: string) {
    if (!hasEnom()) return { success: false, error: 'Registrar non configuré.' };
    const parts = splitDomain(domainName);
    if (!parts) return { success: false, error: 'Domaine invalide.' };
    try {
        const xml = await enomGet('GetAuthInfo', { sld: parts.sld, tld: parts.tld });
        const code = xml.match(/<EPPAuthInfo>(.*?)<\/EPPAuthInfo>/)?.[1];
        return code ? { success: true, code } : { success: false, error: 'Code EPP non disponible.' };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ─── Transfert entrant ─────────────────────────────────────────────────────────

export async function initiateTransferIn(domainName: string, eppCode: string) {
    const user = await getAuthenticatedUser();
    if (!user) return { success: false, error: 'Non authentifié.' };
    if (!hasEnom()) return { success: false, error: 'Registrar non configuré.' };
    const parts = splitDomain(domainName);
    if (!parts) return { success: false, error: 'Domaine invalide.' };
    const tx = await createTransaction({
        user, typeCode: 'DOMAIN_TRANSFER', amount: 8, currency: 'USD',
        description: `Transfert entrant ${domainName}`,
        metadata: { domain: domainName }
    });
    if (!tx.success) return { success: false, error: tx.error };
    try {
        const xml = await enomGet('TP_CreateOrder', {
            SLD1: parts.sld, TLD1: parts.tld, AuthInfo1: eppCode,
            OrderType: 'transfer',
        });
        const done = xml.includes('<Done>true</Done>') || xml.includes('<OrderID>');
        if (!done) {
            const err = xml.match(/<Err1>(.*?)<\/Err1>/)?.[1] || 'Transfert échoué.';
            return { success: false, error: err };
        }
        await ensureTables();
        await db.query(
            `INSERT INTO cloudmax_domains (user_id, domain_name, registrar, status)
             VALUES ($1,$2,'enom','transferring') ON CONFLICT DO NOTHING`,
            [user.id, domainName.toLowerCase()]
        );
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

// ─── Hébergement ───────────────────────────────────────────────────────────────

const HOSTING_PLANS = {
    starter:   { label: 'Starter',    storage_gb: 10,   price_usd: 3,  price_month: true  },
    pro:       { label: 'Pro',         storage_gb: 50,   price_usd: 8,  price_month: true  },
    unlimited: { label: 'Illimité',    storage_gb: null, price_usd: 15, price_month: true  },
} as const;
export type HostingPlan = keyof typeof HOSTING_PLANS;
export { HOSTING_PLANS };

export async function createHostingAccount(plan: HostingPlan, domainName?: string) {
    try {
        await ensureTables();
        const user = await getAuthenticatedUser();
        if (!user) return { success: false, error: 'Non authentifié.' };
        const p = HOSTING_PLANS[plan];
        if (!p) return { success: false, error: 'Plan invalide.' };
        const tx = await createTransaction({
            user, typeCode: 'HOSTING_BUY', amount: p.price_usd, currency: 'USD',
            description: `Hébergement ${p.label}${domainName ? ` pour ${domainName}` : ''}`,
            metadata: { plan, domain: domainName }
        });
        if (!tx.success) return { success: false, error: tx.error };

        let domainId: number | null = null;
        if (domainName) {
            const { rows } = await db.query(
                `SELECT id FROM cloudmax_domains WHERE domain_name=$1 AND user_id=$2`,
                [domainName.toLowerCase(), user.id]
            );
            if (rows[0]) domainId = rows[0].id;
        }
        const expires = new Date();
        expires.setMonth(expires.getMonth() + 1);
        // Le VPS_HOST sera l'IP du serveur d'hébergement partagé configuré en .env
        const vpsHost = process.env.CLOUDMAX_VPS_HOST || null;
        const { rows } = await db.query(
            `INSERT INTO cloudmax_hosting_accounts
             (user_id, domain_id, plan, storage_gb, status, vps_host, expires_at)
             VALUES ($1,$2,$3,$4,'active',$5,$6) RETURNING id`,
            [user.id, domainId, plan, p.storage_gb, vpsHost, expires]
        );
        return { success: true, accountId: rows[0].id };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getHostingAccounts() {
    try {
        await ensureTables();
        const user = await getAuthenticatedUser();
        if (!user) return { success: false, data: [] };
        const { rows } = await db.query(
            `SELECT h.*, d.domain_name
             FROM cloudmax_hosting_accounts h
             LEFT JOIN cloudmax_domains d ON d.id = h.domain_id
             WHERE h.user_id=$1
             ORDER BY h.created_at DESC`,
            [user.id]
        );
        return { success: true, data: rows };
    } catch (e: any) {
        return { success: false, data: [], error: e.message };
    }
}

// Stubs conservés pour compat avec les imports existants
export async function sendRegistrantConsentEmail(_domain: string) { return { success: true }; }
export async function manageDnssec(_domain: string, _s: any) { return { success: true }; }
