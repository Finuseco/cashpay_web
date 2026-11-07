import { getAuthenticatedUser } from '@/lib/actions/user.actions';
import { countryToCode } from '@/lib/utils';
import { countries } from '@/lib/countries';
import { db } from '@/lib/db';
import type { PoolClient } from 'pg';

const roles = ['Admin', 'SuperAgent', 'SubSuperAgent'];
const rank: Record<string, number> = { Admin: 3, SuperAgent: 2, SubSuperAgent: 1 };
export async function requireSuperAgent(claimedId?: number, connection?: PoolClient) {
    const user = await getAuthenticatedUser();
    if (!user || !roles.includes(user.role)) throw new Error('Session de gestionnaire requise.');
    if (claimedId !== undefined && Number(claimedId) !== Number(user.id)) throw new Error('L’identité du gestionnaire ne correspond pas à la session.');
    const { rows } = await (connection || db).query('SELECT id, role, country, province, status, full_name, id_wallet FROM users WHERE id = $1', [user.id]);
    const actor = rows[0];
    if (!actor || !roles.includes(actor.role) || String(actor.status).toLowerCase() !== 'active') throw new Error('Compte gestionnaire inactif.');
    if (actor.role !== 'Admin' && !actor.country?.trim()) throw new Error('Pays de juridiction non configuré.');
    if (actor.role === 'SubSuperAgent' && !actor.province?.trim()) throw new Error('Province de juridiction non configurée.');
    return actor;
}
export function countryIdentity(value: string): string {
    return (countryToCode(value) || value).trim().toLowerCase();
}
export async function regionalScope(country?: string, alias = 'u', connection?: PoolClient) {
    if (!/^[a-z][a-z0-9_]*$/i.test(alias)) throw new Error('Alias de juridiction invalide.');
    const actor = await requireSuperAgent(undefined, connection);
    const selected = actor.role === 'Admin' ? (country || actor.country) : actor.country;
    if (!selected) throw new Error('Sélectionnez un pays.');
    if (country && actor.role !== 'Admin' && countryIdentity(country) !== countryIdentity(actor.country)) throw new Error('Pays hors de votre juridiction.');
    const code = countryToCode(selected);
    const canonical = countries.find(item => item.code === code)?.name || selected;
    const values: unknown[] = [[...new Set([selected, canonical, code].filter(Boolean).map(value => String(value).trim().toLowerCase()))]];
    let sql = `LOWER(TRIM(${alias}.country)) = ANY($1::text[])`;
    if (actor.role === 'SubSuperAgent') { values.push(actor.province.trim().toLowerCase()); sql += ` AND LOWER(TRIM(COALESCE(${alias}.province, ''))) = $2`; }
    return { actor, sql: `(${sql})`, values, country: selected, countryCode: code };
}
export async function assertManagedUser(actorId: number, targetId: number, connection?: PoolClient) {
    const actor = await requireSuperAgent(actorId, connection);
    const { rows } = await (connection || db).query('SELECT id, role, country, province, full_name, id_wallet FROM users WHERE id = $1', [targetId]);
    const target = rows[0];
    if (!target) throw new Error('Utilisateur cible introuvable.');
    if (actor.role !== 'Admin') {
        if (countryIdentity(actor.country) !== countryIdentity(target.country || '')) throw new Error('Utilisateur hors de votre pays.');
        if (actor.role === 'SubSuperAgent' && actor.province.trim().toLowerCase() !== String(target.province || '').trim().toLowerCase()) throw new Error('Utilisateur hors de votre province.');
        if ((rank[target.role] || 0) >= rank[actor.role]) throw new Error('Vous ne pouvez pas administrer un gestionnaire de rang égal ou supérieur.');
    }
    return { actor, target };
}
