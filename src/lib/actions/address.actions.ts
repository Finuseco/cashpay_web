'use server';

import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { Address } from '@/lib/types';

/**
 * Récupère toutes les adresses enregistrées pour un utilisateur.
 */
export async function getUserAddresses(userId: number): Promise<Address[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                id, label, full_name as "fullName", phone, address, 
                province, city, country_code as "countryCode", 
                is_primary as "isPrimary"
            FROM user_addresses 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [userId]);
        return rows as Address[];
    } catch (error) {
        handleDbError(error, 'fetching user addresses');
        return [];
    }
}

/**
 * Ajoute ou met à jour une adresse de livraison dans la base de données.
 */
export async function addOrUpdateUserAddress(userId: number, address: Partial<Address>): Promise<{ success: boolean; error?: string, addresses?: Address[] }> {
    const { id, ...dataToSave } = address;
    
    try {
        if (id && !id.toString().startsWith('addr_')) {
            // Mise à jour d'une adresse existante
            await db.query(`
                UPDATE user_addresses 
                SET label = $1, full_name = $2, phone = $3, address = $4, province = $5, city = $6, country_code = $7 
                WHERE id = $8 AND user_id = $9
            `, [dataToSave.label, dataToSave.fullName, dataToSave.phone, dataToSave.address, dataToSave.province, dataToSave.city, dataToSave.countryCode, id, userId]);
        } else {
            // Création d'une nouvelle adresse
            await db.query(`
                INSERT INTO user_addresses (user_id, label, full_name, phone, address, province, city, country_code) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [userId, dataToSave.label, dataToSave.fullName, dataToSave.phone, dataToSave.address, dataToSave.province, dataToSave.city, dataToSave.countryCode]);
        }
        
        const updatedAddresses = await getUserAddresses(userId);
        return { success: true, addresses: updatedAddresses };
    } catch (error) {
        const dbError = await handleDbError(error, 'adding/updating address');
        return { success: false, error: dbError.error };
    }
}

/**
 * Supprime une adresse de livraison.
 */
export async function deleteUserAddress(userId: number, addressId: string): Promise<{ success: boolean; error?: string, addresses?: Address[] }> {
    try {
        await db.query('DELETE FROM user_addresses WHERE id = $1 AND user_id = $2', [addressId, userId]);
        const updatedAddresses = await getUserAddresses(userId);
        return { success: true, addresses: updatedAddresses };
    } catch (error) {
        const dbError = await handleDbError(error, 'deleting address');
        return { success: false, error: dbError.error };
    }
}
