
      
'use server';

import type { User } from '@/lib/types';
import { createEviaApplication as createApplication, getEviaCountries as getCountries, getApplicationStatus as getStatus, getApplicationAppointments as getAppointments, getApplicationAttachments, downloadAttachmentFromFlux, getTravelServices } from '@/services/flux';
import { db } from '@/lib/db';
import { handleDbError } from './helpers';
import type { PoolClient } from 'pg';
import { createTransaction } from './transaction.actions';
import { verifyCurrentUserPin } from './auth.actions';

export interface EvisaApplicationData {
    destinationCountry: string;
    visaType: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    passportNumber: string;
    passportIssueDate: string;
    passportExpiryDate: string;
    passportPhotoUrl: string;
    passportScanUrl: string;
}

export interface EvisaApplication extends EvisaApplicationData {
    id: number;
    user_id: number;
    flux_application_id: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
    visa_url?: string;
}

export interface EvisaAppointment {
    appointmentId: string;
    date: string;
    time: string;
    location: string;
    type: string;
}


interface SubmitArgs {
    user: User;
    applicationData: EvisaApplicationData;
    totalFee: number;
    pin: string;
}


export async function getEviaCountries() {
    return await getCountries();
}

export async function getVisaTypesForCountry(countryCode: string) {
    const result = await getTravelServices(countryCode);
    if(result.success && result.services) {
        return result.services;
    }
    return [];
}

export async function submitEvisaApplication(args: SubmitArgs): Promise<{ success: boolean; applicationId?: string; error?: string }> {
    const { user, applicationData, totalFee, pin } = args;

    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // 1. Verify user's PIN
        const pinVerification = await verifyCurrentUserPin(pin);
        if (!pinVerification.success) {
            throw new Error(pinVerification.error || "Le code PIN est incorrect.");
        }

        // 2. Debit user for the visa fee
        const transactionResult = await createTransaction({
            user,
            typeCode: 'EVISA_FEE',
            amount: totalFee,
            currency: 'USD',
            description: `Frais de dossier E-Visa pour ${applicationData.destinationCountry}`,
            metadata: {
                destination: applicationData.destinationCountry,
                passport: applicationData.passportNumber,
            },
            connection // Pass the connection to ensure atomicity
        });
        
        if (!transactionResult.success) {
            throw new Error(transactionResult.error || "Le paiement des frais de visa a échoué.");
        }

        // 3. Submit application to Flux API
        const result = await createApplication({
            ...applicationData,
            email: user.email || '',
            phone: user.phone || '',
        });

        if (result.success && result.applicationId) {
            // 4. Save application details to our database
            const dbPayload = {
                user_id: user.id,
                flux_application_id: result.applicationId,
                status: 'pending',
                ...applicationData
            };
            await connection.query('INSERT INTO evisa_applications (user_id, flux_application_id, status, "destinationCountry", "visaType", "firstName", "lastName", "dateOfBirth", "passportNumber", "passportIssueDate", "passportExpiryDate", "passportPhotoUrl", "passportScanUrl") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)', Object.values(dbPayload));
            await connection.query('COMMIT');
            return { success: true, applicationId: result.applicationId };
        } else {
            // If Flux API fails, rollback the transaction
            throw new Error(result.error || "La soumission de la demande au service externe a échoué.");
        }

    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'submitting e-visa application');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}

export async function getEvisaApplicationsForUser(userId: number): Promise<EvisaApplication[]> {
    try {
        const { rows } = await db.query(
            `SELECT * FROM evisa_applications WHERE user_id = $1 ORDER BY created_at DESC`,
            [userId]
        );
        return rows as EvisaApplication[];
    } catch (error) {
        handleDbError(error, 'fetching user e-visa applications');
        return [];
    }
}

export async function updateApplicationStatus(fluxApplicationId: string): Promise<{ success: boolean; status?: 'pending' | 'approved' | 'rejected'; visaUrl?: string, error?: string; }> {
    console.log(`Updating status for application ID: ${fluxApplicationId}`);
    try {
        const result = await getStatus(fluxApplicationId);
        const validStatuses: ('pending' | 'approved' | 'rejected')[] = ['pending', 'approved', 'rejected'];

        if (result.success && result.status && validStatuses.includes(result.status)) {
            let finalVisaUrl = result.visaUrl;
            
            if (result.status === 'approved' && !finalVisaUrl) {
                const attachmentsResult = await getApplicationAttachments(fluxApplicationId);
                if (attachmentsResult.success && attachmentsResult.attachments.length > 0) {
                    finalVisaUrl = attachmentsResult.attachments[0].url; // Store the attachment ID or a reference URL
                }
            }

            await db.query(
                'UPDATE evisa_applications SET status = $1, visa_url = $2 WHERE flux_application_id = $3',
                [result.status, finalVisaUrl || null, fluxApplicationId]
            );
            return { success: true, status: result.status, visaUrl: finalVisaUrl };
        }
        return { success: false, error: result.error || 'Invalid status received.' };
    } catch (error: any) {
        console.error(`Error in updateApplicationStatus for fluxId ${fluxApplicationId}:`, error);
        return { success: false, error: error.message || 'An internal error occurred while updating status.' };
    }
}

export async function getAppointmentsForApplication(fluxApplicationId: string): Promise<{ success: boolean; appointments?: EvisaAppointment[]; error?: string; }> {
    console.log(`[E-Visa Action] Fetching appointments for application ID: ${fluxApplicationId}`);
    return await getAppointments(fluxApplicationId);
}

export async function downloadEvisa(applicationId: string): Promise<{ success: boolean; fileData?: string; fileName?: string; error?: string; }> {
    try {
        const attachments = await getApplicationAttachments(applicationId);
        if (!attachments.success || attachments.attachments.length === 0) {
            return { success: false, error: 'Aucun document de visa trouvé pour cette demande.' };
        }
        
        // Assume the first attachment is the one we want.
        const attachmentId = attachments.attachments[0].url; // Assuming the URL is the ID for the download endpoint
        const fileName = attachments.attachments[0].fileName;

        const downloadResult = await downloadAttachmentFromFlux(attachmentId);

        if (downloadResult.success) {
            return {
                success: true,
                fileData: downloadResult.fileData,
                fileName: fileName
            };
        } else {
            return { success: false, error: downloadResult.error };
        }
    } catch (error: any) {
        return { success: false, error: "Une erreur est survenue lors de la récupération du document." };
    }
}

    