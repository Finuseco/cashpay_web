'use server';

import type { User } from '../types';
import type { VerifyUserInput, VerifyUserOutput } from './types';
import { generateToken, verifyToken } from '../jwt';
import { cookies, headers } from 'next/headers';
import { sendSms } from '@/services/sms';
import { sendEmail } from '@/services/email';
import { sendWhatsAppAuthenticationTemplate } from '@/services/whatsapp';
import { db } from '@/lib/db';
import { handleDbError, saveBase64Image, getUserFromDb } from './helpers';
import { formatUser, countryToCode } from '../utils';
import { countries } from '../countries';
import * as bcrypt from 'bcryptjs';
import { UAParser } from 'ua-parser-js';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { PoolClient } from 'pg';
import { setCardPin as setMarqetaPin } from '@/services/marqeta';
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


function generatePin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

export async function registerUser(data: any): Promise<{ success: true; id_wallet: string; token: string; user: User } | { success: false; error: string; }> {
    const { ...formData } = data;
    
    if (!formData.phone || !formData.countryCode || !formData.country) {
        return { success: false, error: "Les informations de contact (téléphone, pays) sont manquantes. Veuillez recommencer le processus d'inscription." };
    }

    const countryInfo = countries.find(c => c.code === formData.countryCode);
    if (!countryInfo) {
        return { success: false, error: "Le pays sélectionné est invalide." };
    }

    const connection = await db.getConnection();
    
    try {
        await connection.query('BEGIN');

        if (formData.phone) {
            const { rows: phoneRows } = await connection.query('SELECT id FROM users WHERE phone = $1', [formData.phone]);
            if (phoneRows.length > 0) {
                throw new Error("Ce numéro de téléphone est déjà utilisé par un autre compte.");
            }
        }
        if (formData.email) {
            const { rows: emailRows } = await connection.query('SELECT id FROM users WHERE email = $1', [formData.email]);
            if (emailRows.length > 0) {
                throw new Error("Cette adresse email est déjà utilisée par un autre compte.");
            }
        }
        
        const agencyPrefix = `${countryInfo.code}01`;
        
        const id_wallet = await generateUniqueWalletId(agencyPrefix, connection);
        const pin = generatePin();
        const pinHash = await bcrypt.hash(pin, 10);
        
        const profilePhotoPath = await saveBase64Image(formData.profile_photo, 'avatars', id_wallet);
        const signatureImagePath = await saveBase64Image(formData.signature_image, 'signatures', id_wallet);
        const idFrontImagePath = await saveBase64Image(formData.id_front_image, 'documents', `${id_wallet}_front`);
        const idBackImagePath = await saveBase64Image(formData.id_back_image, 'documents', `${id_wallet}_back`);


        const newUserPayload = {
            role: 'Client',
            status: 'Active',
            account_type: formData.account_type,
            id_wallet,
            language: formData.language || 'fr',
            ussd_language: formData.ussd_language || 'fr',
            full_name: `${formData.first_name} ${formData.last_name}`,
            first_name: formData.first_name,
            last_name: formData.last_name,
            middle_name: formData.middle_name || null,
            gender: formData.gender || null,
            marital_status: formData.marital_status || null,
            birth_date: formData.birth_date,
            birth_place: formData.birth_place,
            nationality: formData.nationality,
            email: formData.email || null,
            phone: formData.phone,
            country: formData.country, 
            province: formData.province || null,
            city: formData.city,
            address: formData.address,
            profession: formData.profession || null,
            activity_description: formData.activity_description || null,
            income_per_month: formData.income_per_month || null,
            profile_photo: profilePhotoPath,
            cover_photo: null,
            signature_image: signatureImagePath,
            pin_hash: pinHash,
            password_hash: null,
            google_id: null,
            zoom_id: null,
            zoom_refresh_token: null,
            totp_secret: null,
            notifications_channel: ['sms'],
            assistantsettings: null,
            availabilitystatus: 'offline',
            schedule: null,
            representative: formData.representative ? JSON.stringify(formData.representative) : null,
            verification_status: null,
            temp_photo_expires_at: formData.isAiGeneratedPhoto ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
            is_crypto_active: false,
            api_key: null,
            api_secret: null,
        };
        
        const columns = Object.keys(newUserPayload).map(key => `"${key.toLowerCase()}"`).join(', ');
        const placeholders = Object.keys(newUserPayload).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(newUserPayload);

        const { rows: userResultRows } = await connection.query(
            `INSERT INTO users (${columns}) VALUES (${placeholders}) RETURNING id`, 
            values
        );
        const userId = userResultRows[0].id;

        const initialBalances: {[key: string]: number} = { USD: 0, EUR: 0 };
        if (countryInfo.currency_code) {
          initialBalances[countryInfo.currency_code] = 0;
        }

        await connection.query('INSERT INTO wallets (user_id, id_wallet, balances) VALUES ($1, $2, $3)', [userId, id_wallet, initialBalances]);
        
        if (formData.referralCode) {
            const { rows: referrerRows } = await connection.query('SELECT id FROM users WHERE id_wallet = $1', [formData.referralCode]);
            if (referrerRows.length > 0) {
                const referrerId = referrerRows[0].id;
                await connection.query('INSERT INTO referrals (referrer_user_id, referred_user_id, status) VALUES ($1, $2, $3)', [referrerId, userId, 'Pending Deposit']);
            }
        }
        
        const userDocument = {
            user_id: userId,
            id_type: formData.id_type,
            id_number: formData.id_number,
            id_issued_date: formData.id_issued_date,
            id_expiry_date: formData.id_expiry_date,
            id_front_image: idFrontImagePath,
            id_back_image: idBackImagePath,
        };
        await connection.query('INSERT INTO user_documents (user_id, id_type, id_number, id_issued_date, id_expiry_date, id_front_image, id_back_image) VALUES ($1, $2, $3, $4, $5, $6, $7)', Object.values(userDocument));

        const passportTypes = ['passport', 'biometric_passport', 'diplomatic_passport', 'consular_card'];
        if (passportTypes.includes(formData.id_type)) {
            await connection.query('INSERT INTO user_verifications (user_id, status, notes) VALUES ($1, $2, $3)', [userId, 'blue', 'Auto-vérifié via passeport']);
        }
        
        const { rows: createdUserRows } = await connection.query('SELECT * FROM users WHERE id = $1', [userId]);

        const token = generateToken({ id: userId, id_wallet, role: 'Client' });
        const finalUserObject: User = formatUser(createdUserRows[0]);
        
        await connection.query('COMMIT');
        
        const welcomeMessage = `Bienvenue chez CashPay! Votre ID portefeuille est: ${id_wallet}. Votre PIN initial est: ${pin}. Veuillez le changer rapidement.`;
        if (newUserPayload.phone) {
            sendSms(newUserPayload.phone, welcomeMessage).catch(console.error);
        }
        if (newUserPayload.email) {
            sendEmail(
                newUserPayload.email,
                "Bienvenue chez CashPay !",
                'welcome',
                {
                    userName: finalUserObject.full_name,
                    walletId: finalUserObject.id_wallet,
                    pin: pin,
                }
            ).catch(console.error);
        }

        return { success: true, id_wallet, token, user: finalUserObject };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        if (error.code === '23505') { // PostgreSQL unique violation
            if (error.message.includes('phone')) return { success: false, error: "Ce numéro de téléphone est déjà utilisé." };
            if (error.message.includes('email')) return { success: false, error: "Cette adresse email est déjà utilisée." };
        }
        const dbError = await handleDbError(error, 'registering user');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}

export async function findUserForLogin(walletId: string): Promise<{ success: true, userId: number, availableChannels: ('sms' | 'email' | 'whatsapp' | 'in-app')[], isGoogleLinked: boolean, maskedPhone?: string, maskedEmail?: string } | { success: false, error: string }> {
    if (!walletId) {
        return { success: false, error: 'ID de portefeuille non fourni.' };
    }
    
    let connection;
    try {
        connection = await db.getConnection();
        const { rows } = await connection.query('SELECT id, email, phone FROM users WHERE id_wallet = $1', [walletId]);
        
        if (rows.length === 0) {
            return { success: false, error: 'Utilisateur non trouvé.' };
        }
        const user = rows[0];

        const contactDetails = await getOtpContactDetails(user.id);
        
        if (user.email && !contactDetails.availableChannels.includes('email')) {
            contactDetails.availableChannels.push('email');
            contactDetails.maskedEmail = maskEmail(user.email);
        }

        if (user.phone && !contactDetails.availableChannels.includes('whatsapp')) {
            contactDetails.availableChannels.push('whatsapp');
        }

        const isGoogleLinked = false; 

        return { success: true, userId: user.id, isGoogleLinked, ...contactDetails };
    } catch (error) {
        const dbError = await handleDbError(error, 'finding user for login');
        return { success: false, error: dbError.error };
    } finally {
        if (connection) connection.release();
    }
}


export async function verifyOtp(userId: number, otp: string): Promise<{ success: true; user?: User; token?: string } | { success: false; error: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: otpRows } = await connection.query(
            `SELECT id FROM otps WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > NOW() FOR UPDATE`,
            [userId, otp]
        );

        if (otpRows.length === 0) {
            await connection.query('ROLLBACK');
            return { success: false, error: "Le code de vérification est invalide ou a expiré." };
        }
        
        await connection.query(`UPDATE otps SET used = true WHERE id = $1`, [otpRows[0].id]);
        
        const { rows: userRows } = await connection.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userRows.length === 0) {
            throw new Error("Utilisateur non trouvé après vérification OTP.");
        }
        
        await connection.query('COMMIT');
        
        const user = userRows[0];
        const token = generateToken(user as User);
        logUserSessionAndNotify(user).catch(console.error);

        return { success: true, user: formatUser(user), token };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'verifying OTP');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}

type SendOtpSuccess = { success: true; error: null };
type SendOtpError = { success: false; error: string };

export async function verifyRegistrationOtp(phone: string, otp: string): Promise<{ success: true; error: null } | { success: false; error: string }> {
     try {
        const { rows: otpRows } = await db.query(
            `SELECT id FROM registration_otps WHERE destination = $1 AND code = $2 AND used = false AND expires_at > NOW()`,
            [phone, otp]
        );

        if (otpRows.length === 0) {
            return { success: false, error: "Le code de vérification est invalide ou a expiré." };
        }
        
        await db.query(`UPDATE registration_otps SET used = true WHERE id = $1`, [otpRows[0].id]);
        
        return { success: true, error: null };

    } catch (error) {
        const dbError = await handleDbError(error, 'verifying registration OTP');
        return { success: false, error: dbError.error || "Une erreur est survenue lors de la vérification du code." };
    }
}


export async function sendAndStoreOtp(userId: number, type: string, channel: 'sms' | 'email' | 'whatsapp' | 'in-app') : Promise<{success: true, message: string, destination: string, userId: number } | {success: false, error?: string, backupOtp?: string, userId?: number}> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    console.log(`[OTP DEBUG] Generated OTP for user ${userId} for action "${type}": ${otp}`);

    try {
        const { rows: userRows } = await db.query('SELECT first_name, email, phone, language, country FROM users WHERE id = $1', [userId]);
        if (userRows.length === 0) {
            return { success: false, error: 'User not found' };
        }
        const user = userRows[0];

        await db.query('INSERT INTO otps (user_id, code, type, channel, expires_at) VALUES ($1, $2, $3, $4, $5)', [userId, otp, type, channel, expiresAt]);
        
        const headerList = await headers();
        const ip = (headerList.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
        const userAgentString = headerList.get('user-agent') ?? '';
        const countryFromHeader = headerList.get('x-vercel-ip-country') || user.country;

        const parser = new UAParser(userAgentString);
        const uaResult = parser.getResult();
        
        let deviceType = uaResult.device.type || 'Ordinateur';
        if (deviceType === 'mobile' || deviceType === 'tablet') {
            deviceType = uaResult.device.vendor ? `${uaResult.device.vendor} ${uaResult.device.model}` : 'Mobile';
        } else {
            deviceType = 'Ordinateur';
        }

        const emailData = {
            title: 'Votre Code de Vérification',
            greeting: `Bonjour ${user.first_name || 'Client'},`,
            intro: `Voici votre code de vérification à usage unique pour ${type}:`,
            otpCode: otp,
            warning: 'Ce code est valide pour 10 minutes. Ne le partagez avec personne.',
            signature: "L'équipe de sécurité CashPay",
            ipAddress: ip,
            deviceType: deviceType,
            browser: `${uaResult.browser.name} ${uaResult.browser.version}`,
            operatingSystem: `${uaResult.os.name} ${uaResult.os.version}`,
            location: countryFromHeader,
            loginTime: format(new Date(), "d MMMM yyyy 'à' HH:mm:ss", { locale: fr }),
        };

        if (channel === 'in-app') {
            return { success: true, message: `OTP a été envoyé au client via l'application.`, destination: 'in-app', userId };
        }
        
        const smsMessage = `CashPay: Votre code pour ${type} est : ${otp}. Ne le partagez pas.`;
        
        let destination = '';
        let sendSuccess = false;

        try {
            if (user.email && channel === 'email') {
                await sendEmail(user.email, 'Votre Code de Vérification CashPay', 'otp', emailData);
                destination = user.email;
                sendSuccess = true;
            } else if (user.phone && (channel === 'sms' || channel === 'whatsapp')) {
                if (channel === 'whatsapp') {
                    const whatsAppResult = await sendWhatsAppAuthenticationTemplate(user.phone, otp);
                    sendSuccess = whatsAppResult.success;
                } else { // 'sms'
                    const smsResult = await sendSms(user.phone, smsMessage);
                    sendSuccess = smsResult.success;
                }
                destination = user.phone;
            }

            if(sendSuccess){
                 return { success: true, message: `Un code a été envoyé à ${destination}.`, destination, userId };
            } else {
                 return { success: false, error: `L'envoi par ${channel} a échoué.`, backupOtp: otp, userId };
            }

        } catch (sendError) {
             console.error(`Failed to send OTP via ${channel}:`, sendError);
             return { success: false, error: `L'envoi par ${channel} a échoué.`, backupOtp: otp, userId };
        }

    } catch (dbError) {
        const handledError = await handleDbError(dbError, 'sending and storing OTP');
        return { success: false, error: handledError.error, userId };
    }
}


export async function sendOtp(userId: number, method: 'sms' | 'email' | 'whatsapp' | 'in-app') {
    return await sendAndStoreOtp(userId, 'login', method);
}

export async function sendRegistrationOtp(destination: string, channel: 'sms' | 'whatsapp' = 'sms'): Promise<SendOtpSuccess | SendOtpError> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    
    try {
        await db.query('INSERT INTO registration_otps (destination, code, expires_at) VALUES ($1, $2, $3)', [destination, otp, expiresAt]);
        const message = `Bienvenue chez CashPay ! Votre code de vérification est : ${otp}. Ne le partagez pas.`;
        
        let sendResult;
        if (channel === 'whatsapp') {
            sendResult = await sendWhatsAppAuthenticationTemplate(destination, otp);
        } else {
            sendResult = await sendSms(destination, message);
        }

        if (sendResult.success) {
            return { success: true, error: null };
        } else {
            console.warn(`Primary OTP channel (${channel}) send failed for ${destination}. Falling back to SMS.`);
            const fallbackResult = await sendSms(destination, message);
            if (fallbackResult.success) {
                return { success: true, error: null };
            }
            return { success: false, error: fallbackResult.message || "L'envoi de l'OTP a échoué sur tous les canaux." };
        }
    } catch(error) {
        const dbError = await handleDbError(error, 'sending registration OTP');
        return { success: false, error: dbError.error };
    }
}


export async function verifyAgentPin(phone: string, pin: string): Promise<{ success: true; user: User; token: string; } | { success: false, error: string }> {
    try {
        const { rows } = await db.query('SELECT * FROM users WHERE phone LIKE $1 AND role IN ($2, $3, $4)', [`%${phone.slice(-9)}`, 'Agent', 'Seller', 'Admin']);

        if (rows.length === 0) {
            return { success: false, error: 'Numéro ou rôle invalide.' };
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(pin, user.pin_hash);

        if (!isMatch) {
            return { success: false, error: 'Code PIN incorrect.' };
        }

        const token = generateToken(user as User);
        
        await logUserSessionAndNotify(user);

        return { success: true, user: formatUser(user), token };

    } catch (error) {
        const dbError = await handleDbError(error, 'verifying agent PIN');
        return { success: false, error: dbError.error };
    }
}

export async function verifyUserPin(userId: number, pin: string): Promise<{ success: boolean, error?: string }> {
    try {
        const { rows: userRows } = await db.query('SELECT pin_hash FROM users WHERE id = $1', [userId]);
        if (userRows.length === 0) {
            return { success: false, error: 'Utilisateur non trouvé.' };
        }
        const user = userRows[0];
        if (!user.pin_hash) {
            return { success: false, error: 'Aucun PIN n\'est configuré pour ce compte.' };
        }
        
        const isHashed = user.pin_hash.startsWith('$2a$') || user.pin_hash.startsWith('$2b$');
        
        let isMatch = false;
        if (isHashed) {
            isMatch = await bcrypt.compare(pin, user.pin_hash);
        } else {
            isMatch = (pin === user.pin_hash);
            if (isMatch) {
                const newHash = await bcrypt.hash(pin, 10);
                await db.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [newHash, userId]);
                console.log(`User ${userId} PIN has been upgraded to a hash.`);
            }
        }

        if (!isMatch) {
            return { success: false, error: 'Code PIN incorrect.' };
        }
        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'verifying user PIN');
        return { success: false, error: dbError.error };
    }
}

export async function verifyCurrentUserPin(pin: string): Promise<{ success: boolean; error?: string }> {
    const cookieStore = cookies();
    const authorization = headers().get('authorization');
    const token = authorization?.startsWith('Bearer ')
        ? authorization.slice(7).trim()
        : cookieStore.get('cashpay-token')?.value;

    if (!token) {
        return { success: false, error: "Session non valide. Veuillez vous reconnecter." };
    }

    const decodedPayload = verifyToken(token);
    if (!decodedPayload) {
        return { success: false, error: "Jeton de session invalide." };
    }
    return await verifyUserPin(decodedPayload.id, pin);
}


export async function verifyPinAndCreateSession(userId: number, pin: string): Promise<{ success: true; user: User } | { success: false, error: string }> {
    const verification = await verifyUserPin(userId, pin);
    if (!verification.success) {
        return { success: false, error: verification.error || 'PIN verification failed' };
    }

    try {
        const { rows: userRows } = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userRows.length === 0) {
            return { success: false, error: 'Utilisateur non trouvé.' };
        }

        const user = userRows[0];
        const token = generateToken(user as User);
        const cookieStore = cookies();
        cookieStore.set('cashpay-token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'strict', path: '/', maxAge: 60 * 60 * 24 * 30 });
        
        await logUserSessionAndNotify(user);

        return { success: true, user: formatUser(user) };
    } catch (error) {
        const dbError = await handleDbError(error, 'verifying PIN and creating session');
        return { success: false, error: dbError.error };
    }
}

const maskEmail = (email: string | null): string | undefined => {
    if (!email) return undefined;
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return email;
    const maskedLocal = `${localPart.charAt(0)}${'*'.repeat(localPart.length - 2)}${localPart.charAt(localPart.length - 1)}`;
    return `${maskedLocal}@${domain}`;
};

const maskPhone = (phone: string | null): string | undefined => {
    if (!phone) return undefined;
    if (phone.length <= 4) return phone;
    return `${phone.slice(0, -4).replace(/./g, '*')}${phone.slice(-4)}`;
};

export async function getOtpContactDetails(userId: number): Promise<{ phone?: string | null; email?: string | null; maskedPhone?: string; maskedEmail?: string; availableChannels: ('sms' | 'email' | 'whatsapp' | 'in-app')[] }> {
    try {
        const { rows } = await db.query('SELECT phone, email, notifications_channel, totp_secret FROM users WHERE id = $1', [userId]);
        if (rows.length === 0) {
            return { availableChannels: [] };
        }
        const user = rows[0];
        const { phone, email } = user;
        
        let availableChannels: ('sms' | 'email' | 'whatsapp' | 'in-app')[] = [];
        const configuredChannelsRaw = user.notifications_channel;
        let configuredChannels: string[] = [];

        if (configuredChannelsRaw) {
            try {
                const parsed = typeof configuredChannelsRaw === 'string'
                    ? JSON.parse(configuredChannelsRaw)
                    : configuredChannelsRaw;
                if (Array.isArray(parsed)) {
                    configuredChannels = parsed;
                }
            } catch (e) {
                console.error("Failed to parse notifications_channel:", e);
                configuredChannels = [];
            }
        }
        
        if (Array.isArray(configuredChannels) && configuredChannels.length > 0) {
            availableChannels = configuredChannels as ('sms' | 'email' | 'whatsapp' | 'in-app')[];
        } else {
            if (phone) availableChannels.push('sms', 'whatsapp');
            if (email) availableChannels.push('email');
            if (user.totp_secret) availableChannels.push('in-app');
        }
        
        const finalChannels = availableChannels.filter(c => (c === 'email' && email) || (c !== 'email' && phone) || (c === 'in-app' && user.totp_secret));

        return { phone, email, maskedPhone: maskPhone(phone), maskedEmail: maskEmail(email), availableChannels: finalChannels };
    } catch (error) {
        const dbError = await handleDbError(error, 'getting OTP contact details');
        return { availableChannels: [] };
    }
}

export async function sendWorkerPinBySms(phone: string): Promise<{ success: true, pin: string } | { success: false, error: string }> {
    const pin = generatePin();
    
    try {
        const pinHash = await bcrypt.hash(pin, 10);
        await db.query('UPDATE users SET pin_hash = $1 WHERE phone LIKE $2', [pinHash, `%${phone.slice(-9)}`]);
        await sendSms(phone, `Votre code PIN de connexion pour l'espace travailleur CashPay est : ${pin}. Ne le partagez pas.`);
        return { success: true, pin };
    } catch(error) {
        const dbError = await handleDbError(error, 'sending worker PIN');
        return { success: false, error: dbError.error };
    }
}


export async function verifyUser(input: VerifyUserInput): Promise<VerifyUserOutput> {
  const { walletId } = input;
  
  if (!/^[A-Z]{2}\d{10}$/.test(walletId)) {
      return {
          isValid: false,
          userName: null,
          reason: "Format d'ID invalide. Il doit commencer par 2 lettres suivies de 10 chiffres.",
          userId: 0
      }
  }

  try {
      const { rows } = await db.query('SELECT id, full_name, country FROM users WHERE id_wallet = $1', [walletId]);
      if (rows.length > 0) {
          const user = rows[0];
          const code = countryToCode(user.country);
          return {
              isValid: true,
              userName: user.full_name,
              reason: "ID valide.",
              userId: user.id,
              walletId,
              countryCode: code ?? undefined
          };
      } else {
          return {
            isValid: false,
            userName: null,
            reason: "L'ID de portefeuille n'a pas été trouvé.",
            userId: 0
          };
      }
  } catch (error) {
      const dbError = await handleDbError(error, 'verifying user wallet ID');
      return {
          isValid: false,
          userName: null,
          reason: "Une erreur de base de données est survenue pendant la vérification.",
          userId: 0
      };
  }
}

export async function checkExistingUser(identifier: string): Promise<{ exists: boolean }> {
  try {
    const { rows } = await db.query('SELECT id FROM users WHERE phone = $1 OR email = $2', [identifier, identifier]);
    return { exists: rows.length > 0 };
  } catch (error) {
    await handleDbError(error, 'checking existing user');
    return { exists: false };
  }
}


export async function logout(): Promise<void> {
  const cookieStore = cookies();
  cookieStore.delete('cashpay-token');
}


export async function resetPinWithOtp(userId: number, otp: string, newPin: string): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        const { rows: otpRows } = await connection.query(
            `SELECT id FROM otps WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > NOW()`,
            [userId, otp]
        );
        if (otpRows.length === 0) {
            throw new Error("Code de vérification invalide ou expiré.");
        }
        await connection.query(`UPDATE otps SET used = true WHERE id = $1`, [otpRows[0].id]);
        
        const pinHash = await bcrypt.hash(newPin, 10);
        const { rowCount } = await connection.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [pinHash, userId]);

        if (rowCount === 0) {
            throw new Error("Utilisateur non trouvé lors de la mise à jour du PIN.");
        }
        
        await connection.query('COMMIT');
        
        const { rows: userRows } = await db.query('SELECT first_name, email FROM users WHERE id = $1', [userId]);
        if (userRows.length > 0 && userRows[0].email) {
            const user = userRows[0];
            await sendEmail(user.email, "Confirmation de changement de PIN", 'general', {
                title: "Votre PIN a été changé",
                greeting: `Bonjour ${user.first_name},`,
                message: "Ceci est une confirmation que le code PIN de votre compte CashPay a été réinitialisé avec succès. Si vous n'êtes pas à l'origine de cette action, veuillez contacter immédiatement notre support.",
                buttonText: 'Contacter le Support',
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/feedback`,
                signature: "L'équipe de sécurité CashPay"
            });
        }
        
        return { success: true };
    } catch (error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'resetting PIN with OTP');
        return { success: false, error: error.message || dbError.error };
    } finally {
        connection.release();
    }
}

export async function logUserSessionAndNotify(user: any) {
    if (!user || !user.id) return;

    try {
        const headerList = headers();
        const ip = (headerList.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
        const userAgentString = headerList.get('user-agent') ?? '';
        const countryFromHeader = headerList.get('x-vercel-ip-country') || user.country;
        
        const parser = new UAParser(userAgentString);
        const uaResult = parser.getResult();
        
        let deviceType = uaResult.device.type || 'Ordinateur';
        if (deviceType === 'mobile' || deviceType === 'tablet') {
            deviceType = uaResult.device.vendor ? `${uaResult.device.vendor} ${uaResult.device.model}` : 'Mobile';
        } else {
            deviceType = 'Ordinateur';
        }
        
        const sessionData = {
            user_id: user.id,
            ip_address: ip,
            user_agent: userAgentString,
            user_agent_details: JSON.stringify({
                browser: `${uaResult.browser.name} ${uaResult.browser.version}`,
                os: `${uaResult.os.name} ${uaResult.os.version}`,
                device: deviceType,
                country: countryFromHeader
            })
        };
        await db.query('INSERT INTO user_sessions (user_id, ip_address, user_agent, user_agent_details) VALUES ($1, $2, $3, $4)', Object.values(sessionData));
        
        const now = new Date();

        if (user.email && user.email.includes('@')) {
            sendEmail(user.email, "Alerte de Sécurité : Nouvelle Connexion", 'new_login_alert', {
                userName: user.first_name || user.full_name,
                loginTime: format(now, "d MMMM yyyy 'à' HH:mm:ss", { locale: fr }),
                ipAddress: ip,
                deviceType: deviceType,
                browser: `${uaResult.browser.name} ${uaResult.browser.version}`,
                operatingSystem: `${uaResult.os.name} ${uaResult.os.version}`,
                location: countryFromHeader,
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
            }).catch(console.error);
        } else {
             console.log(`User ${user.id} does not have a valid email. Skipping login notification.`);
        }
        
    } catch(e) {
        console.error("Failed to log session or send notification email:", e);
    }
}


// Functions for Developer Portal
export async function findDeveloperByEmail(email: string): Promise<{ success: boolean; userId?: number; error?: string; }> {
    if (!email) {
        return { success: false, error: 'Email non fourni.' };
    }
    try {
        const { rows } = await db.query('SELECT id FROM users WHERE email = $1 AND role IN ($2, $3)', [email, 'Agent', 'Admin']);
        if (rows.length === 0) {
            return { success: false, error: 'Aucun compte développeur trouvé pour cet e-mail.' };
        }
        return { success: true, userId: rows[0].id };
    } catch (error) {
        const dbError = await handleDbError(error, 'finding developer by email');
        return { success: false, error: dbError.error };
    }
}

export async function loginDeveloper(email: string) {
    // This is now simplified. The full login flow will handle OTP.
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1 AND role IN ($2, $3)', [email, 'Agent', 'Admin']);
    if (rows.length === 0) {
        return { success: false, error: 'Aucun compte développeur trouvé pour cet e-mail.' };
    }
    return await sendAndStoreOtp(rows[0].id, 'Developer Portal Login', 'email');
}


export async function verifyDeveloperOtp(userId: number, otp: string) {
    const result = await verifyOtp(userId, otp);
    // Overwrite the cookie name for the developer portal
    if (result.success && result.token) {
        cookies().set('dev-portal-token', result.token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'strict', path: '/', maxAge: 60 * 60 * 24 * 30 });
    }
    return result;
}

export async function verifyDeveloperPin(userId: number, pin: string): Promise<{ success: boolean, error?: string }> {
     return await verifyUserPin(userId, pin);
}

export async function getAuthenticatedDeveloper(): Promise<User | null> {
    const cookieStore = cookies();
    const token = cookieStore.get('dev-portal-token')?.value;

    if (!token) return null;

    const decodedPayload = verifyToken(token, 'dev');
    if (!decodedPayload) return null;

    try {
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1 AND role IN ($2, $3)', [decodedPayload.id, 'Agent', 'Admin']);
        if (rows.length === 0) return null;
        return formatUser(rows[0]);
    } catch (error) {
        await handleDbError(error, 'getting authenticated developer');
        return null;
    }
}

export async function getAuthenticatedUser(): Promise<User | null> {
    const cookieStore = cookies();
    const authorization = headers().get('authorization');
    const token = authorization?.startsWith('Bearer ')
        ? authorization.slice(7).trim()
        : cookieStore.get('cashpay-token')?.value;

    if (!token) {
        console.log("getAuthenticatedUser: No token found in cookies.");
        return null;
    }

    const decodedPayload = verifyToken(token);
    if (!decodedPayload || !decodedPayload.id) {
        console.log("getAuthenticatedUser: Invalid token.");
        return null;
    }

    try {
        const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [decodedPayload.id]);
        if (rows.length === 0) {
            console.log(`getAuthenticatedUser: User with id ${decodedPayload.id} not found.`);
            return null;
        }
        return formatUser(rows[0]);
    } catch (error) {
        await handleDbError(error, 'getting authenticated user');
        return null;
    }
}

export async function getAllUsers(): Promise<User[]> {
    try {
        const { rows } = await db.query('SELECT * FROM users');
        return rows.map(formatUser);
    } catch (error) {
        await handleDbError(error, 'getting all users');
        return [];
    }
}


export async function checkContacts(phoneNumbers: string[]): Promise<{
    phone: string;
    onChat: boolean;
    user?: Partial<User>;
    hasActiveStatus: boolean;
}[]> {
    if (phoneNumbers.length === 0) return [];

    try {
        const sanitizedNumbers = phoneNumbers.map(p =>
            p.replace(/\D/g, '').slice(-9)
        );

        const conditions = sanitizedNumbers
            .map((_, i) => `u.phone LIKE $${i + 1}`)
            .join(' OR ');

        const params = sanitizedNumbers.map(n => `%${n}`);

        const { rows } = await db.query(`
            SELECT
                u.id,
                u.full_name,
                u.profile_photo,
                u.phone,
                EXISTS (
                    SELECT 1
                    FROM statuses s
                    WHERE s.user_id = u.id
                      AND s.expires_at > NOW()
                ) AS has_active_status
            FROM users u
            WHERE ${conditions}
        `, params);

        const onChatUsers = new Map(rows.map(user => {
            const userPhoneSuffix = user.phone.slice(-9);

            return [
                userPhoneSuffix,
                {
                    id: user.id,
                    full_name: user.full_name,
                    profile_photo: user.profile_photo,
                }
            ];
        }));

        const activeStatusUsers = new Map(rows.map(user => [
            user.phone.slice(-9),
            Boolean(user.has_active_status)
        ]));

        return phoneNumbers.map(originalPhone => {
            const sanitized = originalPhone.replace(/\D/g, '').slice(-9);
            const user = onChatUsers.get(sanitized);

            return {
                phone: originalPhone,
                onChat: !!user,
                user,
                hasActiveStatus: user
                    ? activeStatusUsers.get(sanitized) === true
                    : false,
            };
        });
    } catch (error) {
        await handleDbError(error, 'checking contacts');

        return phoneNumbers.map(phone => ({
            phone,
            onChat: false,
            hasActiveStatus: false,
        }));
    }
}

interface UpdateUserArgs {
    userId: number;
    updates: Partial<Pick<User, 'first_name' | 'last_name' | 'profession' | 'activity_description' | 'address' | 'city' | 'profile_photo' | 'cover_photo' | 'full_name'>>;
}

export async function updateUser({ userId, updates }: UpdateUserArgs): Promise<{ success: boolean; user?: User; error?: string; }> {
    const connection = await db.getConnection();
    try {
        await connection.query('BEGIN');

        // Check if profile_photo or cover_photo are base64 and save them
        if (updates.profile_photo && updates.profile_photo.startsWith('data:image')) {
            const savedPath = await saveBase64Image(updates.profile_photo, 'avatars', `user_${userId}`);
            if (savedPath) {
                updates.profile_photo = savedPath;
            } else {
                delete updates.profile_photo; // Don't update if saving fails
            }
        }
        if (updates.cover_photo && updates.cover_photo.startsWith('data:image')) {
            const savedPath = await saveBase64Image(updates.cover_photo, 'covers', `user_${userId}`);
            if (savedPath) {
                updates.cover_photo = savedPath;
            } else {
                delete updates.cover_photo;
            }
        }

        const { rows: existingUserRows } = await connection.query('SELECT first_name, last_name FROM users WHERE id = $1', [userId]);
        const existingUser = existingUserRows[0];

        const firstName = updates.first_name || existingUser.first_name;
        const lastName = updates.last_name || existingUser.last_name;
        updates.full_name = `${firstName} ${lastName}`;

        const setClauses = Object.keys(updates).map((key, i) => `${key.toLowerCase()} = $${i + 1}`);
        const values = Object.values(updates);

        const { rowCount } = await connection.query(`UPDATE users SET ${setClauses.join(', ')} WHERE id = $${values.length + 1}`, [...values, userId]);
        
        if (rowCount === 0) {
            throw new Error("Utilisateur non trouvé ou aucune mise à jour effectuée.");
        }

        const { rows: updatedUserRows } = await connection.query('SELECT * FROM users WHERE id = $1', [userId]);

        await connection.query('COMMIT');

        return { success: true, user: formatUser(updatedUserRows[0]) };
    } catch(error: any) {
        await connection.query('ROLLBACK');
        const dbError = await handleDbError(error, 'updating user profile');
        return { success: false, error: dbError.error || error.message };
    } finally {
        connection.release();
    }
}

interface UpdatePinArgs {
    userId: number;
    oldPin: string;
    newPin: string;
}

/**
 * Met à jour le code PIN de l'utilisateur et synchronise le changement avec ses cartes Marqeta.
 */
export async function updatePin({ userId, oldPin, newPin }: UpdatePinArgs): Promise<{ success: boolean; error?: string }> {
    const connection = await db.getConnection();
    const headerList = headers();
    const ipAddress = (headerList.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();

    try {
        await connection.query('BEGIN');

        // 1. Vérifier l'ancien PIN
        const { rows: userRows } = await connection.query('SELECT pin_hash FROM users WHERE id = $1', [userId]);
        if (userRows.length === 0) throw new Error('Utilisateur non trouvé.');
        
        const user = userRows[0];
        if (!user.pin_hash) throw new Error('Aucun PIN configuré. Contactez le support.');
        
        const isMatch = await bcrypt.compare(oldPin, user.pin_hash);
        if (!isMatch) throw new Error('Votre ancien code PIN est incorrect.');

        // 2. Récupérer toutes les cartes actives pour synchronisation
        const { rows: cardRows } = await connection.query('SELECT id, marqeta_card_token FROM cards WHERE user_id = $1 AND status = $2', [userId, 'active']);

        // 3. Mettre à jour le PIN chez Marqeta pour chaque carte
        for (const card of cardRows) {
            if (card.marqeta_card_token) {
                // Marqeta nécessite une idempotencyKey unique par requête
                const idempotencyKey = crypto.randomUUID();
                await setMarqetaPin(card.marqeta_card_token, newPin, idempotencyKey, ipAddress);
            }
        }

        // 4. Mettre à jour le hash local dans la base CashPay
        const newHash = await bcrypt.hash(newPin, 10);
        await connection.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [newHash, userId]);

        await connection.query('COMMIT');
        return { success: true };

    } catch (error: any) {
        await connection.query('ROLLBACK');
        console.error('[Update Pin Action] Critical error:', error.message);
        return { success: false, error: error.message };
    } finally {
        connection.release();
    }
}

export async function savePushSubscription(userId: number, subscription: any): Promise<{ success: boolean }> {
    try {
        const { endpoint } = subscription;
        await db.query(
            'INSERT INTO push_subscriptions (user_id, endpoint, subscription_data) VALUES ($1, $2, $3) ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, subscription_data = $3',
            [userId, endpoint, JSON.stringify(subscription)]
        );
        return { success: true };
    } catch (error) {
        await handleDbError(error, 'saving push subscription');
        return { success: false };
    }
}


export async function findUserByWalletId(walletId: string): Promise<User | null> {
    try {
        const { rows } = await db.query('SELECT * FROM users WHERE id_wallet = $1', [walletId]);
        if (rows.length === 0) {
            return null;
        }
        return formatUser(rows[0]);
    } catch (error) {
        handleDbError(error, 'finding user by wallet id');
        return null;
    }
}

export async function linkZoomAccount(userId: number, zoomId: string, refreshToken: string): Promise<{ success: boolean; error?: string }> {
    try {
        await db.query('UPDATE users SET zoom_id = $1, zoom_refresh_token = $2 WHERE id = $3', [zoomId, refreshToken, userId]);
        return { success: true };
    } catch (error) {
        const dbError = await handleDbError(error, 'linking Zoom account');
        return { success: false, error: dbError.error };
    }
}

export async function findUserByZoomId(zoomId: string): Promise<{ success: boolean; user?: User; token?: string; error?: string }> {
    try {
        const { rows } = await db.query('SELECT * FROM users WHERE zoom_id = $1', [zoomId]);
        if (rows.length === 0) {
            return { success: false, error: 'Aucun compte CashPay n\'est associé à ce compte Zoom.' };
        }
        const user = formatUser(rows[0]);
        const token = generateToken(user);
        return { success: true, user, token };
    } catch (error) {
        const dbError = await handleDbError(error, 'finding user by Zoom ID');
        return { success: false, error: dbError.error };
    }
}

export async function getUserCounts(countryCode?: string): Promise<{ totalUsers: number, countryUsers: number }> {
    try {
        const { rows: totalRows } = await db.query('SELECT COUNT(*) FROM users');
        const totalUsers = totalRows[0].count;

        if (countryCode) {
            const countryInfo = countries.find(c => c.code === countryCode);
            if (countryInfo) {
                const { rows: countryRows } = await db.query('SELECT COUNT(*) FROM users WHERE country = $1', [countryInfo.name]);
                return { totalUsers, countryUsers: countryRows[0].count };
            }
        }
        return { totalUsers, countryUsers: 0 };
    } catch (error) {
        handleDbError(error, 'getting user counts');
        return { totalUsers: 0, countryUsers: 0 };
    }
}
