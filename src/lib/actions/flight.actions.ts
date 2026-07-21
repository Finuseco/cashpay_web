'use server';

import type { User, FlightBooking, FlightPassenger } from '@/lib/types';
import { db } from '../db';
import { handleDbError } from './helpers';
import { format } from 'date-fns';
import { createTransaction } from './transaction.actions';
import { verifyCurrentUserPin } from './auth.actions';
import { bookFlight } from '@/services/airlines';
import { generateReferenceCode } from '../utils';

interface BookingRequest {
  offerId: string;
  price: number;
  currency: string;
  airlineName: string;
  originCountry: string;
  destinationCountry: string;
  departureDate: Date;
  returnDate?: Date;
  cabinClass: string;
  passengers: Omit<FlightPassenger, 'id' | 'bookingId'>[];
  pin: string;
}

/**
 * Crée une réservation d'avion automatique avec débit immédiat du compte.
 * Gère la transaction financière et la création du PNR.
 */
export async function createFlightBooking(user: User, bookingData: BookingRequest) {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Validation de sécurité (PIN)
        const pinRes = await verifyCurrentUserPin(bookingData.pin);
        if (!pinRes.success) throw new Error("Votre code PIN est incorrect.");

        const internalRef = generateReferenceCode('FLT');
        
        // 2. Débit du portefeuille de l'utilisateur
        const tx = await createTransaction({
            user,
            typeCode: 'AIRLINE_TICKET',
            amount: bookingData.price,
            currency: bookingData.currency,
            description: `Billet d'avion ${bookingData.airlineName} : ${bookingData.originCountry} ✈ ${bookingData.destinationCountry}`,
            metadata: { 
                airline: bookingData.airlineName,
                internalRef,
                paxCount: bookingData.passengers.length 
            },
            status: 'Pending',
            connection
        });

        if (!tx.success || !tx.transactionId) {
            throw new Error(tx.error || "Paiement échoué. Vérifiez votre solde.");
        }

        // 3. Appel de l'API de réservation (Processus automatique via NDC/GDS)
        const apiResult = await bookFlight(bookingData.offerId, bookingData.passengers);
        
        if (!apiResult.success || !apiResult.pnr) {
            throw new Error(apiResult.error || "La compagnie aérienne a rejeté la réservation. Aucun fonds n'a été prélevé.");
        }

        // 4. Enregistrement de la réservation en base de données
        const flightBooking = {
            user_id: user.id,
            booking_reference: apiResult.pnr,
            origin_country: bookingData.originCountry,
            destination_country: bookingData.destinationCountry,
            departure_date: format(new Date(bookingData.departureDate), 'yyyy-MM-dd'),
            return_date: bookingData.returnDate ? format(new Date(bookingData.returnDate), 'yyyy-MM-dd') : null,
            booking_status: 'confirmed',
            payment_status: 'paid',
            total_fare: bookingData.price,
            currency: bookingData.currency,
            transaction_id: tx.transactionId
        };

        const { rows: resultRows } = await connection.query(`
            INSERT INTO flight_bookings 
            (user_id, booking_reference, origin_country, destination_country, departure_date, return_date, booking_status, payment_status, total_fare, currency, transaction_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id
        `, Object.values(flightBooking));
        
        const newBookingId = resultRows[0].id;

        // 5. Enregistrement des passagers
        for (const passenger of bookingData.passengers) {
            await connection.query(`
                INSERT INTO flight_passengers (booking_id, first_name, last_name, date_of_birth, passport_number) 
                VALUES ($1, $2, $3, $4, $5)
            `, [newBookingId, passenger.firstName, passenger.lastName, format(new Date(passenger.dateOfBirth), 'yyyy-MM-dd'), passenger.passportNumber]);
        }

        // 6. Validation finale de la transaction
        await connection.query('UPDATE transactions SET status = $1 WHERE id = $2', ['Completed', tx.transactionId]);

        await connection.query('COMMIT');

        return { 
            success: true, 
            bookingReference: apiResult.pnr,
            message: "Votre billet a été émis avec succès. Vous recevrez une copie par e-mail." 
        };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

/**
 * Récupère les réservations de vols d'un utilisateur.
 */
export async function getMyBookings(userId: number): Promise<any[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                fb.*,
                t.description,
                (SELECT COUNT(*) FROM flight_passengers WHERE booking_id = fb.id) as passenger_count
            FROM flight_bookings fb
            JOIN transactions t ON fb.transaction_id = t.id
            WHERE fb.user_id = $1 
            ORDER BY fb.created_at DESC
        `, [userId]);
        return rows;
    } catch (e) {
        return [];
    }
}

/**
 * Récupère toutes les réservations nationales (Super Agent).
 */
export async function getCountryFlightBookings(countryName: string): Promise<any[]> {
    try {
        const { rows } = await db.query(`
            SELECT 
                fb.*, 
                u.full_name as user_name,
                u.id_wallet as user_wallet
            FROM flight_bookings fb
            JOIN users u ON fb.user_id = u.id
            WHERE u.country = $1
            ORDER BY fb.created_at DESC
        `, [countryName]);
        return rows;
    } catch (e) {
        return [];
    }
}
