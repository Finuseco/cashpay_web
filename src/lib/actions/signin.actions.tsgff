'use server';

import { db } from '@/lib/db';
import { handleDbError, saveBase64Image } from './helpers';
import { formatUser } from '../utils';
import { countries } from '../countries';
import * as bcrypt from 'bcryptjs';
import { generateToken } from '../jwt';
import { sendSms } from '@/services/sms';
import { sendEmail } from '@/services/email';
import { sendWhatsAppTextMessage } from '@/services/whatsapp';
import type { User } from '../types';
import type { PoolClient } from 'pg';
import crypto from 'crypto';

async function generateUniqueWalletId(agencyPrefix: string, connection: PoolClient): Promise<string> {
    const { rows } = await connection.query(
        "SELECT id_wallet FROM users WHERE id_wallet LIKE $1 || '%' ORDER BY id_wallet DESC LIMIT 1 FOR UPDATE",
        [agencyPrefix]
    );

    let nextNumericPart = 1;
    if (rows.length > 0) {
        const lastWalletId = rows[0].id_wallet;
        const lastNumericPart = parseInt(lastWalletId.substring(4), 10);
        nextNumericPart = lastNumericPart + 1;
    }

    const newNumericPart = nextNumericPart.toString().padStart(8, '0');
    return `${agencyPrefix}${newNumericPart}`;
}

export async function checkAvailability(type: 'email' | 'id_number', value: string) {
    try {
        let query = '';
        if (type === 'email') {
            query = 'SELECT id FROM users WHERE email = $1';
        } else {
            query = 'SELECT id FROM user_documents WHERE id_number = $1';
        }
        const { rows } = await db.query(query, [value]);
        return { available: rows.length === 0 };
    } catch (e) {
        return { available: false, error: "Erreur de vérification." };
    }
}

export async function sendEmailOtp(email: string) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    try {
        await db.query('BEGIN');
        // Invalidate previous OTPs for this email
        await db.query("UPDATE registration_otps SET used = true WHERE destination = $1 AND used = false", [email]);
        // Insert new OTP
        await db.query('INSERT INTO registration_otps (destination, code, expires_at) VALUES ($1, $2, $3)', [email, otp, expiresAt]);
        
        await sendEmail(email, 'Votre Code de Vérification CashPay', 'otp', {
            title: 'Code de Vérification',
            otpCode: otp,
            warning: 'Ce code est valide pendant 10 minutes.',
            signature: "L'équipe CashPay All"
        });

        await db.query('COMMIT');
        return { success: true };
    } catch (error) {
        await db.query('ROLLBACK');
        console.error("Send OTP Error:", error);
        return { success: false, error: "Échec de l'envoi de l'OTP." };
    }
}

export async function verifyEmailOtp(email: string, otp: string) {
    try {
        const { rows } = await db.query(
            'SELECT id FROM registration_otps WHERE destination = $1 AND code = $2 AND used = false AND expires_at > NOW()',
            [email, otp]
        );
        if (rows.length === 0) return { success: false, error: "Code invalide ou expiré." };

        await db.query('UPDATE registration_otps SET used = true WHERE id = $1', [rows[0].id]);
        return { success: true };
    } catch (e) {
        return { success: false, error: "Erreur de vérification." };
    }
}

export async function registerNewAccount(data: any): Promise<{ success: boolean; id_wallet?: string; token?: string; user?: User; error?: string }> {
    const { ...formData } = data;
    
    console.log("[Register Action] Starting registration for:", formData.email || formData.phone);

    if (!formData.phone || !formData.countryCode || !formData.country) {
        return { success: false, error: "Informations de contact manquantes." };
    }

    const countryInfo = countries.find(c => c.code.toUpperCase() === formData.countryCode.toUpperCase());
    if (!countryInfo) {
        console.error(`Invalid country code: ${formData.countryCode}`);
        return { success: false, error: "Pays invalide." };
    }

    const connection = await db.getConnection();
    
    try {
        await connection.query('BEGIN');

        const sanitizedLang = (formData.language || 'fr').split('-')[0].toLowerCase().substring(0, 2);

        const agencyPrefix = `${countryInfo.code.toUpperCase()}01`;
        const id_wallet = await generateUniqueWalletId(agencyPrefix, connection);
        const rawPin = Math.floor(1000 + Math.random() * 9000).toString();
        const pinHash = await bcrypt.hash(rawPin, 10);
        
        const profilePhotoPath = await saveBase64Image(formData.profile_photo, 'avatars', id_wallet);
        const idFrontImagePath = await saveBase64Image(formData.id_front_image, 'documents', `${id_wallet}_front`);
        const signatureImagePath = await saveBase64Image(formData.signature_image, 'signatures', id_wallet);

        const isBusiness = formData.account_type === 'business';
        const role = isBusiness ? 'PartnerB2B' : 'Client';
        
        const fullName = isBusiness 
            ? (formData.company_name || 'ENTREPRISE SANS NOM').toUpperCase() 
            : `${formData.first_name} ${formData.last_name} ${formData.middle_name || ''}`.trim().toUpperCase();

        let apiKey = null, apiSecret = null, testApiKey = null, testApiSecret = null;

        if (isBusiness) {
            apiKey = `cp_live_${crypto.randomBytes(12).toString('hex')}`;
            apiSecret = `csk_live_${crypto.randomBytes(24).toString('hex')}`;
            testApiKey = `cp_test_${crypto.randomBytes(12).toString('hex')}`;
            testApiSecret = `csk_test_${crypto.randomBytes(24).toString('hex')}`;
        }

        const validateDate = (dateStr: any) => {
            if (!dateStr || dateStr === "") return null;
            const d = new Date(dateStr);
            return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
        };

        const newUserPayload: any = {
            role: role,
            status: 'Active',
            account_type: formData.account_type,
            id_wallet: id_wallet,
            language: sanitizedLang,
            full_name: fullName,
            first_name: formData.first_name,
            last_name: formData.last_name,
            middle_name: formData.middle_name || null,
            gender: formData.gender,
            birth_date: validateDate(formData.birth_date),
            marital_status: formData.marital_status,
            nationality: formData.nationality || '',
            email: formData.email,
            phone: formData.phone,
            country: formData.country, 
            city: formData.city,
            address: formData.address,
            profession: formData.profession,
            profile_photo: profilePhotoPath,
            signature_image: signatureImagePath,
            pin_hash: pinHash,
            representative: JSON.stringify(formData.representative),
            availabilitystatus: 'offline',
            is_crypto_active: false,
            api_key: apiKey,
            api_secret: apiSecret,
            test_api_key: testApiKey,
            test_api_secret: testApiSecret,
        };

        const keys = Object.keys(newUserPayload);
        const columns = keys.map(key => `"${key.toLowerCase()}"`).join(', ');
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(newUserPayload);

        const { rows: userResult } = await connection.query(
            `INSERT INTO users (${columns}) VALUES (${placeholders}) RETURNING id`, 
            values
        );
        const userId = userResult[0].id;

        const initialBalances: any = { USD: 0, EUR: 0 };
        if (countryInfo.currency_code) {
          initialBalances[countryInfo.currency_code] = 0;
        }
        await connection.query('INSERT INTO wallets (user_id, id_wallet, balances) VALUES ($1, $2, $3::jsonb)', [userId, id_wallet, initialBalances]);
        
        await connection.query(
            `INSERT INTO user_documents (user_id, id_type, id_number, id_front_image, id_issued_date, id_expiry_date) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [userId, formData.id_type, formData.id_number, idFrontImagePath, validateDate(formData.id_issued_date), validateDate(formData.id_expiry_date)]
        );

        await connection.query('COMMIT');
        
        const finalUser = formatUser({ ...newUserPayload, id: userId, created_at: new Date() });
        const token = generateToken(finalUser);

        const welcomeMessage = `Bienvenue chez CashPay All! Votre ID portefeuille: ${id_wallet}. PIN provisoire: ${rawPin}. Changez-le rapidement.`;
        sendSms(formData.phone, welcomeMessage).catch(console.error);
        sendWhatsAppTextMessage(formData.phone, welcomeMessage).catch(console.error);

        if (formData.email) {
            sendEmail(formData.email, 'Bienvenue chez CashPay All', 'welcome', {
                userName: newUserPayload.first_name || fullName,
                walletId: id_wallet,
                pin: rawPin,
                dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
            }).catch(console.error);

            if (isBusiness) {
                sendEmail(formData.email, 'Vos Identifiants Développeur CashPay', 'b2b_welcome', {
                    companyName: fullName,
                    apiKey: apiKey,
                    apiSecret: apiSecret,
                    testApiKey: testApiKey,
                    testApiSecret: testApiSecret,
                    buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
                }).catch(console.error);
            }
        }

        return { success: true, id_wallet, token, user: finalUser };

    } catch (error: any) {
        if (connection) await connection.query('ROLLBACK');
        console.error("[Register Error]", error);
        const dbError = handleDbError(error);
        if (dbError) return dbError;
        return { success: false, error: error.message || "Échec de l'enregistrement." };
    } finally {
        if (connection) connection.release();
    }
}
