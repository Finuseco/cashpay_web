
'use server';

import { db } from '@/lib/db';
import { handleDbError, saveBase64Image } from './helpers';
import { formatUser, countryToCode, generateReferenceCode } from '../utils';
import { createTransaction } from './transaction.actions';
import { calculateTransactionFee } from './wallet.actions';
import { verifyCurrentUserPin } from './auth.actions';
import type { User } from '@/lib/types';

export interface HotelRoom {
    id: number;
    hotel_id: number;
    room_type: string;
    price: number;
    description: string;
    images: string[];
    is_available: boolean;
    status: 'active' | 'inactive';
}

export interface Hotel {
    id: number;
    owner_user_id: number;
    name: string;
    description: string;
    address: string;
    city: string;
    province: string;
    country_code: string;
    phone: string;
    email: string;
    lat?: number;
    lng?: number;
    rooms?: HotelRoom[];
    subscription_status?: string;
}

/**
 * Enregistre ou met à jour un établissement hôtelier.
 */
export async function saveHotelEstablishment(userId: number, data: Partial<Hotel>): Promise<{ success: boolean; error?: string; hotel?: Hotel }> {
    try {
        if (data.id) {
            await db.query(`
                UPDATE hotel_establishments 
                SET name = $1, description = $2, address = $3, city = $4, province = $5, phone = $6, email = $7, lat = $8, lng = $9
                WHERE id = $10 AND owner_user_id = $11
            `, [data.name, data.description, data.address, data.city, data.province, data.phone, data.email, data.lat, data.lng, data.id, userId]);
            return { success: true };
        } else {
            const { rows } = await db.query(`
                INSERT INTO hotel_establishments (owner_user_id, name, description, address, city, province, country_code, phone, email, lat, lng)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *
            `, [userId, data.name, data.description, data.address, data.city, data.province, data.country_code, data.phone, data.email, data.lat, data.lng]);
            return { success: true, hotel: rows[0] };
        }
    } catch (error) {
        const dbError = await handleDbError(error, 'saving hotel');
        return { success: false, error: dbError.error };
    }
}

/**
 * Gère l'ajout d'une chambre avec support de 4 images.
 */
export async function saveHotelRoom(userId: number, data: any): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // Sécurité : Vérifier que l'hôtel appartient bien à l'utilisateur
        const { rows: hotelCheck } = await connection.query('SELECT id FROM hotel_establishments WHERE id = $1 AND owner_user_id = $2', [data.hotel_id, userId]);
        if (hotelCheck.length === 0) throw new Error("Accès non autorisé à cet établissement.");

        const imageUrls = [];
        if (data.images && Array.isArray(data.images)) {
            for (let i = 0; i < data.images.length; i++) {
                const img = data.images[i];
                if (img.startsWith('data:image')) {
                    const path = await saveBase64Image(img, 'hotels/rooms', `room_${data.hotel_id}_${Date.now()}_${i}`);
                    if (path) imageUrls.push(path);
                } else {
                    imageUrls.push(img);
                }
            }
        }

        if (data.id) {
            await connection.query(`
                UPDATE hotel_rooms SET room_type = $1, price = $2, description = $3, images = $4, is_available = $5
                WHERE id = $6 AND hotel_id = $7
            `, [data.room_type, data.price, data.description, JSON.stringify(imageUrls), data.is_available, data.id, data.hotel_id]);
        } else {
            await connection.query(`
                INSERT INTO hotel_rooms (hotel_id, room_type, price, description, images, is_available, status)
                VALUES ($1, $2, $3, $4, $5, $6, 'active')
            `, [data.hotel_id, data.room_type, data.price, data.description, JSON.stringify(imageUrls), data.is_available]);
        }

        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

/**
 * Système d'Abonnement SaaS sans commission.
 */
export async function subscribeHotel(userId: number, planAmount: number, pin: string): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Vérifier le PIN
        const pinRes = await verifyCurrentUserPin(pin);
        if (!pinRes.success) throw new Error("PIN de sécurité incorrect.");

        // 2. Récupérer l'utilisateur
        const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1', [userId]);
        const user = formatUser(userRows[0]);

        // 3. Débiter le compte (Transaction réelle)
        const tx = await createTransaction({
            user,
            typeCode: 'HOTEL_SUB',
            amount: planAmount,
            currency: 'USD',
            description: 'Abonnement mensuel Plateforme Hôtels (SaaS)',
            metadata: { plan: planAmount },
            connection
        });

        if (!tx.success) throw new Error(tx.error || "Solde insuffisant.");

        // 4. Mettre à jour la date d'expiration (30 jours)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);

        await connection.query(`
            INSERT INTO hotel_subscriptions (user_id, status, current_period_end, amount)
            VALUES ($1, 'active', $2, $3)
            ON CONFLICT (user_id) DO UPDATE SET
                status = 'active',
                current_period_end = EXCLUDED.current_period_end,
                updated_at = NOW()
        `, [userId, expiryDate, planAmount]);

        await connection.query('COMMIT');
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

/**
 * Recherche intelligente multi-critères.
 */
export async function searchHotels(params: { country?: string; province?: string; city?: string; query?: string }): Promise<Hotel[]> {
    try {
        let sql = `
            SELECT h.*, 
                   (SELECT status FROM hotel_subscriptions WHERE user_id = h.owner_user_id) as sub_status,
                   (SELECT current_period_end FROM hotel_subscriptions WHERE user_id = h.owner_user_id) as sub_end
            FROM hotel_establishments h
            WHERE 1=1
        `;
        const queryParams: any[] = [];
        let pIndex = 1;

        if (params.country) { sql += ` AND country_code = $${pIndex++}`; queryParams.push(params.country); }
        if (params.province) { sql += ` AND province = $${pIndex++}`; queryParams.push(params.province); }
        if (params.city) { sql += ` AND (city ILIKE $${pIndex} OR address ILIKE $${pIndex})`; queryParams.push(`%${params.city}%`); pIndex++; }
        if (params.query) { sql += ` AND (name ILIKE $${pIndex} OR description ILIKE $${pIndex})`; queryParams.push(`%${params.query}%`); pIndex++; }

        const { rows } = await db.query(sql, queryParams);

        // Filtrage des hôtels non-abonnés
        return rows.filter(h => h.sub_status === 'active' && new Date(h.sub_end) > new Date());
    } catch (error) {
        return [];
    }
}

export async function getHotelDetails(hotelId: number): Promise<Hotel | null> {
    try {
        const { rows: hotelRows } = await db.query('SELECT * FROM hotel_establishments WHERE id = $1', [hotelId]);
        if (hotelRows.length === 0) return null;
        
        const { rows: roomRows } = await db.query('SELECT * FROM hotel_rooms WHERE hotel_id = $1 AND status = \'active\'', [hotelId]);
        
        return {
            ...hotelRows[0],
            rooms: roomRows.map(r => ({ ...r, images: safeParse(r.images, []) }))
        };
    } catch (e) { return null; }
}

function safeParse(val: any, fallback: any) {
    try { return typeof val === 'string' ? JSON.parse(val) : val; } catch (e) { return fallback; }
}
