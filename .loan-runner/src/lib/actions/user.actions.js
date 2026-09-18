'use server';
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.findUserForLogin = findUserForLogin;
exports.verifyOtp = verifyOtp;
exports.verifyRegistrationOtp = verifyRegistrationOtp;
exports.sendAndStoreOtp = sendAndStoreOtp;
exports.sendOtp = sendOtp;
exports.sendRegistrationOtp = sendRegistrationOtp;
exports.verifyAgentPin = verifyAgentPin;
exports.verifyUserPin = verifyUserPin;
exports.verifyCurrentUserPin = verifyCurrentUserPin;
exports.verifyPinAndCreateSession = verifyPinAndCreateSession;
exports.getOtpContactDetails = getOtpContactDetails;
exports.sendWorkerPinBySms = sendWorkerPinBySms;
exports.verifyUser = verifyUser;
exports.checkExistingUser = checkExistingUser;
exports.logout = logout;
exports.resetPinWithOtp = resetPinWithOtp;
exports.logUserSessionAndNotify = logUserSessionAndNotify;
exports.findDeveloperByEmail = findDeveloperByEmail;
exports.loginDeveloper = loginDeveloper;
exports.verifyDeveloperOtp = verifyDeveloperOtp;
exports.verifyDeveloperPin = verifyDeveloperPin;
exports.getAuthenticatedDeveloper = getAuthenticatedDeveloper;
exports.getAuthenticatedUser = getAuthenticatedUser;
exports.getAllUsers = getAllUsers;
exports.checkContacts = checkContacts;
exports.updateUser = updateUser;
exports.updatePin = updatePin;
exports.savePushSubscription = savePushSubscription;
exports.findUserByWalletId = findUserByWalletId;
exports.linkZoomAccount = linkZoomAccount;
exports.findUserByZoomId = findUserByZoomId;
exports.getUserCounts = getUserCounts;
const jwt_1 = require("../jwt");
const headers_1 = require("next/headers");
const sms_1 = require("@/services/sms");
const email_1 = require("@/services/email");
const whatsapp_1 = require("@/services/whatsapp");
const db_1 = require("@/lib/db");
const helpers_1 = require("./helpers");
const utils_1 = require("../utils");
const countries_1 = require("../countries");
const bcrypt = __importStar(require("bcryptjs"));
const ua_parser_js_1 = require("ua-parser-js");
const date_fns_1 = require("date-fns");
const locale_1 = require("date-fns/locale");
const marqeta_1 = require("@/services/marqeta");
const crypto_1 = __importDefault(require("crypto"));
async function generateUniqueWalletId(agencyPrefix, connection) {
    const { rows } = await connection.query("SELECT id_wallet FROM users WHERE id_wallet LIKE $1 || '%' ORDER BY id_wallet DESC LIMIT 1 FOR UPDATE", [agencyPrefix]);
    let nextNumericPart = 1;
    if (rows.length > 0) {
        const lastWalletId = rows[0].id_wallet;
        const lastNumericPart = parseInt(lastWalletId.substring(4), 10);
        nextNumericPart = lastNumericPart + 1;
    }
    const newNumericPart = nextNumericPart.toString().padStart(8, '0');
    return `${agencyPrefix}${newNumericPart}`;
}
function generatePin() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}
async function registerUser(data) {
    const { ...formData } = data;
    if (!formData.phone || !formData.countryCode || !formData.country) {
        return { success: false, error: "Les informations de contact (téléphone, pays) sont manquantes. Veuillez recommencer le processus d'inscription." };
    }
    const countryInfo = countries_1.countries.find(c => c.code === formData.countryCode);
    if (!countryInfo) {
        return { success: false, error: "Le pays sélectionné est invalide." };
    }
    const connection = await db_1.db.getConnection();
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
        const profilePhotoPath = await (0, helpers_1.saveBase64Image)(formData.profile_photo, 'avatars', id_wallet);
        const signatureImagePath = await (0, helpers_1.saveBase64Image)(formData.signature_image, 'signatures', id_wallet);
        const idFrontImagePath = await (0, helpers_1.saveBase64Image)(formData.id_front_image, 'documents', `${id_wallet}_front`);
        const idBackImagePath = await (0, helpers_1.saveBase64Image)(formData.id_back_image, 'documents', `${id_wallet}_back`);
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
            mlm_rank_id: null,
            api_key: null,
            api_secret: null,
            left_child_id: null,
            right_child_id: null,
        };
        const columns = Object.keys(newUserPayload).map(key => `"${key.toLowerCase()}"`).join(', ');
        const placeholders = Object.keys(newUserPayload).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(newUserPayload);
        const { rows: userResultRows } = await connection.query(`INSERT INTO users (${columns}) VALUES (${placeholders}) RETURNING id`, values);
        const userId = userResultRows[0].id;
        const initialBalances = { USD: 0, EUR: 0 };
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
        const token = (0, jwt_1.generateToken)({ id: userId, id_wallet, role: 'Client' });
        const finalUserObject = (0, utils_1.formatUser)(createdUserRows[0]);
        await connection.query('COMMIT');
        const welcomeMessage = `Bienvenue chez CashPay! Votre ID portefeuille est: ${id_wallet}. Votre PIN initial est: ${pin}. Veuillez le changer rapidement.`;
        if (newUserPayload.phone) {
            (0, sms_1.sendSms)(newUserPayload.phone, welcomeMessage).catch(console.error);
        }
        if (newUserPayload.email) {
            (0, email_1.sendEmail)(newUserPayload.email, "Bienvenue chez CashPay !", 'welcome', {
                userName: finalUserObject.full_name,
                walletId: finalUserObject.id_wallet,
                pin: pin,
            }).catch(console.error);
        }
        return { success: true, id_wallet, token, user: finalUserObject };
    }
    catch (error) {
        await connection.query('ROLLBACK');
        if (error.code === '23505') { // PostgreSQL unique violation
            if (error.message.includes('phone'))
                return { success: false, error: "Ce numéro de téléphone est déjà utilisé." };
            if (error.message.includes('email'))
                return { success: false, error: "Cette adresse email est déjà utilisée." };
        }
        const dbError = await (0, helpers_1.handleDbError)(error, 'registering user');
        return { success: false, error: dbError.error || error.message };
    }
    finally {
        connection.release();
    }
}
async function findUserForLogin(walletId) {
    if (!walletId) {
        return { success: false, error: 'ID de portefeuille non fourni.' };
    }
    let connection;
    try {
        connection = await db_1.db.getConnection();
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
    }
    catch (error) {
        const dbError = await (0, helpers_1.handleDbError)(error, 'finding user for login');
        return { success: false, error: dbError.error };
    }
    finally {
        if (connection)
            connection.release();
    }
}
async function verifyOtp(userId, otp) {
    const connection = await db_1.db.getConnection();
    try {
        await connection.query('BEGIN');
        const { rows: otpRows } = await connection.query(`SELECT id FROM otps WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > NOW() FOR UPDATE`, [userId, otp]);
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
        const token = (0, jwt_1.generateToken)(user);
        logUserSessionAndNotify(user).catch(console.error);
        return { success: true, user: (0, utils_1.formatUser)(user), token };
    }
    catch (error) {
        await connection.query('ROLLBACK');
        const dbError = await (0, helpers_1.handleDbError)(error, 'verifying OTP');
        return { success: false, error: dbError.error || error.message };
    }
    finally {
        connection.release();
    }
}
async function verifyRegistrationOtp(phone, otp) {
    try {
        const { rows: otpRows } = await db_1.db.query(`SELECT id FROM registration_otps WHERE destination = $1 AND code = $2 AND used = false AND expires_at > NOW()`, [phone, otp]);
        if (otpRows.length === 0) {
            return { success: false, error: "Le code de vérification est invalide ou a expiré." };
        }
        await db_1.db.query(`UPDATE registration_otps SET used = true WHERE id = $1`, [otpRows[0].id]);
        return { success: true, error: null };
    }
    catch (error) {
        const dbError = await (0, helpers_1.handleDbError)(error, 'verifying registration OTP');
        return { success: false, error: dbError.error || "Une erreur est survenue lors de la vérification du code." };
    }
}
async function sendAndStoreOtp(userId, type, channel) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    console.log(`[OTP DEBUG] Generated OTP for user ${userId} for action "${type}": ${otp}`);
    try {
        const { rows: userRows } = await db_1.db.query('SELECT first_name, email, phone, language, country FROM users WHERE id = $1', [userId]);
        if (userRows.length === 0) {
            return { success: false, error: 'User not found' };
        }
        const user = userRows[0];
        await db_1.db.query('INSERT INTO otps (user_id, code, type, channel, expires_at) VALUES ($1, $2, $3, $4, $5)', [userId, otp, type, channel, expiresAt]);
        const headerList = await (0, headers_1.headers)();
        const ip = (headerList.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
        const userAgentString = headerList.get('user-agent') ?? '';
        const countryFromHeader = headerList.get('x-vercel-ip-country') || user.country;
        const parser = new ua_parser_js_1.UAParser(userAgentString);
        const uaResult = parser.getResult();
        let deviceType = uaResult.device.type || 'Ordinateur';
        if (deviceType === 'mobile' || deviceType === 'tablet') {
            deviceType = uaResult.device.vendor ? `${uaResult.device.vendor} ${uaResult.device.model}` : 'Mobile';
        }
        else {
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
            loginTime: (0, date_fns_1.format)(new Date(), "d MMMM yyyy 'à' HH:mm:ss", { locale: locale_1.fr }),
        };
        if (channel === 'in-app') {
            return { success: true, message: `OTP a été envoyé au client via l'application.`, destination: 'in-app', userId };
        }
        const smsMessage = `CashPay: Votre code pour ${type} est : ${otp}. Ne le partagez pas.`;
        let destination = '';
        let sendSuccess = false;
        try {
            if (user.email && channel === 'email') {
                await (0, email_1.sendEmail)(user.email, 'Votre Code de Vérification CashPay', 'otp', emailData);
                destination = user.email;
                sendSuccess = true;
            }
            else if (user.phone && (channel === 'sms' || channel === 'whatsapp')) {
                if (channel === 'whatsapp') {
                    const whatsAppResult = await (0, whatsapp_1.sendWhatsAppAuthenticationTemplate)(user.phone, otp);
                    sendSuccess = whatsAppResult.success;
                }
                else { // 'sms'
                    const smsResult = await (0, sms_1.sendSms)(user.phone, smsMessage);
                    sendSuccess = smsResult.success;
                }
                destination = user.phone;
            }
            if (sendSuccess) {
                return { success: true, message: `Un code a été envoyé à ${destination}.`, destination, userId };
            }
            else {
                return { success: false, error: `L'envoi par ${channel} a échoué.`, backupOtp: otp, userId };
            }
        }
        catch (sendError) {
            console.error(`Failed to send OTP via ${channel}:`, sendError);
            return { success: false, error: `L'envoi par ${channel} a échoué.`, backupOtp: otp, userId };
        }
    }
    catch (dbError) {
        const handledError = await (0, helpers_1.handleDbError)(dbError, 'sending and storing OTP');
        return { success: false, error: handledError.error, userId };
    }
}
async function sendOtp(userId, method) {
    return await sendAndStoreOtp(userId, 'login', method);
}
async function sendRegistrationOtp(destination, channel = 'sms') {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    try {
        await db_1.db.query('INSERT INTO registration_otps (destination, code, expires_at) VALUES ($1, $2, $3)', [destination, otp, expiresAt]);
        const message = `Bienvenue chez CashPay ! Votre code de vérification est : ${otp}. Ne le partagez pas.`;
        let sendResult;
        if (channel === 'whatsapp') {
            sendResult = await (0, whatsapp_1.sendWhatsAppAuthenticationTemplate)(destination, otp);
        }
        else {
            sendResult = await (0, sms_1.sendSms)(destination, message);
        }
        if (sendResult.success) {
            return { success: true, error: null };
        }
        else {
            console.warn(`Primary OTP channel (${channel}) send failed for ${destination}. Falling back to SMS.`);
            const fallbackResult = await (0, sms_1.sendSms)(destination, message);
            if (fallbackResult.success) {
                return { success: true, error: null };
            }
            return { success: false, error: fallbackResult.message || "L'envoi de l'OTP a échoué sur tous les canaux." };
        }
    }
    catch (error) {
        const dbError = await (0, helpers_1.handleDbError)(error, 'sending registration OTP');
        return { success: false, error: dbError.error };
    }
}
async function verifyAgentPin(phone, pin) {
    try {
        const { rows } = await db_1.db.query('SELECT * FROM users WHERE phone LIKE $1 AND role IN ($2, $3, $4)', [`%${phone.slice(-9)}`, 'Agent', 'Seller', 'Admin']);
        if (rows.length === 0) {
            return { success: false, error: 'Numéro ou rôle invalide.' };
        }
        const user = rows[0];
        const isMatch = await bcrypt.compare(pin, user.pin_hash);
        if (!isMatch) {
            return { success: false, error: 'Code PIN incorrect.' };
        }
        const token = (0, jwt_1.generateToken)(user);
        await logUserSessionAndNotify(user);
        return { success: true, user: (0, utils_1.formatUser)(user), token };
    }
    catch (error) {
        const dbError = await (0, helpers_1.handleDbError)(error, 'verifying agent PIN');
        return { success: false, error: dbError.error };
    }
}
async function verifyUserPin(userId, pin) {
    try {
        const { rows: userRows } = await db_1.db.query('SELECT pin_hash FROM users WHERE id = $1', [userId]);
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
        }
        else {
            isMatch = (pin === user.pin_hash);
            if (isMatch) {
                const newHash = await bcrypt.hash(pin, 10);
                await db_1.db.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [newHash, userId]);
                console.log(`User ${userId} PIN has been upgraded to a hash.`);
            }
        }
        if (!isMatch) {
            return { success: false, error: 'Code PIN incorrect.' };
        }
        return { success: true };
    }
    catch (error) {
        const dbError = await (0, helpers_1.handleDbError)(error, 'verifying user PIN');
        return { success: false, error: dbError.error };
    }
}
async function verifyCurrentUserPin(pin) {
    const cookieStore = (0, headers_1.cookies)();
    const token = cookieStore.get('cashpay-token')?.value;
    if (!token) {
        return { success: false, error: "Session non valide. Veuillez vous reconnecter." };
    }
    const decodedPayload = (0, jwt_1.verifyToken)(token);
    if (!decodedPayload) {
        return { success: false, error: "Jeton de session invalide." };
    }
    return await verifyUserPin(decodedPayload.id, pin);
}
async function verifyPinAndCreateSession(userId, pin) {
    const verification = await verifyUserPin(userId, pin);
    if (!verification.success) {
        return { success: false, error: verification.error || 'PIN verification failed' };
    }
    try {
        const { rows: userRows } = await db_1.db.query('SELECT * FROM users WHERE id = $1', [userId]);
        if (userRows.length === 0) {
            return { success: false, error: 'Utilisateur non trouvé.' };
        }
        const user = userRows[0];
        const token = (0, jwt_1.generateToken)(user);
        const cookieStore = (0, headers_1.cookies)();
        cookieStore.set('cashpay-token', token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'strict', path: '/' });
        await logUserSessionAndNotify(user);
        return { success: true, user: (0, utils_1.formatUser)(user) };
    }
    catch (error) {
        const dbError = await (0, helpers_1.handleDbError)(error, 'verifying PIN and creating session');
        return { success: false, error: dbError.error };
    }
}
const maskEmail = (email) => {
    if (!email)
        return undefined;
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain)
        return email;
    const maskedLocal = `${localPart.charAt(0)}${'*'.repeat(localPart.length - 2)}${localPart.charAt(localPart.length - 1)}`;
    return `${maskedLocal}@${domain}`;
};
const maskPhone = (phone) => {
    if (!phone)
        return undefined;
    if (phone.length <= 4)
        return phone;
    return `${phone.slice(0, -4).replace(/./g, '*')}${phone.slice(-4)}`;
};
async function getOtpContactDetails(userId) {
    try {
        const { rows } = await db_1.db.query('SELECT phone, email, notifications_channel, totp_secret FROM users WHERE id = $1', [userId]);
        if (rows.length === 0) {
            return { availableChannels: [] };
        }
        const user = rows[0];
        const { phone, email } = user;
        let availableChannels = [];
        const configuredChannelsRaw = user.notifications_channel;
        let configuredChannels = [];
        if (configuredChannelsRaw) {
            try {
                const parsed = typeof configuredChannelsRaw === 'string'
                    ? JSON.parse(configuredChannelsRaw)
                    : configuredChannelsRaw;
                if (Array.isArray(parsed)) {
                    configuredChannels = parsed;
                }
            }
            catch (e) {
                console.error("Failed to parse notifications_channel:", e);
                configuredChannels = [];
            }
        }
        if (Array.isArray(configuredChannels) && configuredChannels.length > 0) {
            availableChannels = configuredChannels;
        }
        else {
            if (phone)
                availableChannels.push('sms', 'whatsapp');
            if (email)
                availableChannels.push('email');
            if (user.totp_secret)
                availableChannels.push('in-app');
        }
        const finalChannels = availableChannels.filter(c => (c === 'email' && email) || (c !== 'email' && phone) || (c === 'in-app' && user.totp_secret));
        return { phone, email, maskedPhone: maskPhone(phone), maskedEmail: maskEmail(email), availableChannels: finalChannels };
    }
    catch (error) {
        const dbError = await (0, helpers_1.handleDbError)(error, 'getting OTP contact details');
        return { availableChannels: [] };
    }
}
async function sendWorkerPinBySms(phone) {
    const pin = generatePin();
    try {
        const pinHash = await bcrypt.hash(pin, 10);
        await db_1.db.query('UPDATE users SET pin_hash = $1 WHERE phone LIKE $2', [pinHash, `%${phone.slice(-9)}`]);
        await (0, sms_1.sendSms)(phone, `Votre code PIN de connexion pour l'espace travailleur CashPay est : ${pin}. Ne le partagez pas.`);
        return { success: true, pin };
    }
    catch (error) {
        const dbError = await (0, helpers_1.handleDbError)(error, 'sending worker PIN');
        return { success: false, error: dbError.error };
    }
}
async function verifyUser(input) {
    const { walletId } = input;
    if (!/^[A-Z]{2}\d{10}$/.test(walletId)) {
        return {
            isValid: false,
            userName: null,
            reason: "Format d'ID invalide. Il doit commencer par 2 lettres suivies de 10 chiffres.",
            userId: 0
        };
    }
    try {
        const { rows } = await db_1.db.query('SELECT id, full_name, country FROM users WHERE id_wallet = $1', [walletId]);
        if (rows.length > 0) {
            const user = rows[0];
            const code = (0, utils_1.countryToCode)(user.country);
            return {
                isValid: true,
                userName: user.full_name,
                reason: "ID valide.",
                userId: user.id,
                walletId,
                countryCode: code ?? undefined
            };
        }
        else {
            return {
                isValid: false,
                userName: null,
                reason: "L'ID de portefeuille n'a pas été trouvé.",
                userId: 0
            };
        }
    }
    catch (error) {
        const dbError = await (0, helpers_1.handleDbError)(error, 'verifying user wallet ID');
        return {
            isValid: false,
            userName: null,
            reason: "Une erreur de base de données est survenue pendant la vérification.",
            userId: 0
        };
    }
}
async function checkExistingUser(identifier) {
    try {
        const { rows } = await db_1.db.query('SELECT id FROM users WHERE phone = $1 OR email = $2', [identifier, identifier]);
        return { exists: rows.length > 0 };
    }
    catch (error) {
        await (0, helpers_1.handleDbError)(error, 'checking existing user');
        return { exists: false };
    }
}
async function logout() {
    const cookieStore = (0, headers_1.cookies)();
    cookieStore.delete('cashpay-token');
}
async function resetPinWithOtp(userId, otp, newPin) {
    const connection = await db_1.db.getConnection();
    try {
        await connection.query('BEGIN');
        const { rows: otpRows } = await connection.query(`SELECT id FROM otps WHERE user_id = $1 AND code = $2 AND used = false AND expires_at > NOW()`, [userId, otp]);
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
        const { rows: userRows } = await db_1.db.query('SELECT first_name, email FROM users WHERE id = $1', [userId]);
        if (userRows.length > 0 && userRows[0].email) {
            const user = userRows[0];
            await (0, email_1.sendEmail)(user.email, "Confirmation de changement de PIN", 'general', {
                title: "Votre PIN a été changé",
                greeting: `Bonjour ${user.first_name},`,
                message: "Ceci est une confirmation que le code PIN de votre compte CashPay a été réinitialisé avec succès. Si vous n'êtes pas à l'origine de cette action, veuillez contacter immédiatement notre support.",
                buttonText: 'Contacter le Support',
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/feedback`,
                signature: "L'équipe de sécurité CashPay"
            });
        }
        return { success: true };
    }
    catch (error) {
        await connection.query('ROLLBACK');
        const dbError = await (0, helpers_1.handleDbError)(error, 'resetting PIN with OTP');
        return { success: false, error: error.message || dbError.error };
    }
    finally {
        connection.release();
    }
}
async function logUserSessionAndNotify(user) {
    if (!user || !user.id)
        return;
    try {
        const headerList = (0, headers_1.headers)();
        const ip = (headerList.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
        const userAgentString = headerList.get('user-agent') ?? '';
        const countryFromHeader = headerList.get('x-vercel-ip-country') || user.country;
        const parser = new ua_parser_js_1.UAParser(userAgentString);
        const uaResult = parser.getResult();
        let deviceType = uaResult.device.type || 'Ordinateur';
        if (deviceType === 'mobile' || deviceType === 'tablet') {
            deviceType = uaResult.device.vendor ? `${uaResult.device.vendor} ${uaResult.device.model}` : 'Mobile';
        }
        else {
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
        await db_1.db.query('INSERT INTO user_sessions (user_id, ip_address, user_agent, user_agent_details) VALUES ($1, $2, $3, $4)', Object.values(sessionData));
        const now = new Date();
        if (user.email && user.email.includes('@')) {
            (0, email_1.sendEmail)(user.email, "Alerte de Sécurité : Nouvelle Connexion", 'new_login_alert', {
                userName: user.first_name || user.full_name,
                loginTime: (0, date_fns_1.format)(now, "d MMMM yyyy 'à' HH:mm:ss", { locale: locale_1.fr }),
                ipAddress: ip,
                deviceType: deviceType,
                browser: `${uaResult.browser.name} ${uaResult.browser.version}`,
                operatingSystem: `${uaResult.os.name} ${uaResult.os.version}`,
                location: countryFromHeader,
                buttonUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
            }).catch(console.error);
        }
        else {
            console.log(`User ${user.id} does not have a valid email. Skipping login notification.`);
        }
    }
    catch (e) {
        console.error("Failed to log session or send notification email:", e);
    }
}
// Functions for Developer Portal
async function findDeveloperByEmail(email) {
    if (!email) {
        return { success: false, error: 'Email non fourni.' };
    }
    try {
        const { rows } = await db_1.db.query('SELECT id FROM users WHERE email = $1 AND role IN ($2, $3)', [email, 'Agent', 'Admin']);
        if (rows.length === 0) {
            return { success: false, error: 'Aucun compte développeur trouvé pour cet e-mail.' };
        }
        return { success: true, userId: rows[0].id };
    }
    catch (error) {
        const dbError = await (0, helpers_1.handleDbError)(error, 'finding developer by email');
        return { success: false, error: dbError.error };
    }
}
async function loginDeveloper(email) {
    // This is now simplified. The full login flow will handle OTP.
    const { rows } = await db_1.db.query('SELECT * FROM users WHERE email = $1 AND role IN ($2, $3)', [email, 'Agent', 'Admin']);
    if (rows.length === 0) {
        return { success: false, error: 'Aucun compte développeur trouvé pour cet e-mail.' };
    }
    return await sendAndStoreOtp(rows[0].id, 'Developer Portal Login', 'email');
}
async function verifyDeveloperOtp(userId, otp) {
    const result = await verifyOtp(userId, otp);
    // Overwrite the cookie name for the developer portal
    if (result.success && result.token) {
        (0, headers_1.cookies)().set('dev-portal-token', result.token, { httpOnly: true, secure: process.env.NODE_ENV !== 'development', sameSite: 'strict', path: '/' });
    }
    return result;
}
async function verifyDeveloperPin(userId, pin) {
    return await verifyUserPin(userId, pin);
}
async function getAuthenticatedDeveloper() {
    const cookieStore = (0, headers_1.cookies)();
    const token = cookieStore.get('dev-portal-token')?.value;
    if (!token)
        return null;
    const decodedPayload = (0, jwt_1.verifyToken)(token, 'dev');
    if (!decodedPayload)
        return null;
    try {
        const { rows } = await db_1.db.query('SELECT * FROM users WHERE id = $1 AND role IN ($2, $3)', [decodedPayload.id, 'Agent', 'Admin']);
        if (rows.length === 0)
            return null;
        return (0, utils_1.formatUser)(rows[0]);
    }
    catch (error) {
        await (0, helpers_1.handleDbError)(error, 'getting authenticated developer');
        return null;
    }
}
async function getAuthenticatedUser() {
    const cookieStore = (0, headers_1.cookies)();
    const token = cookieStore.get('cashpay-token')?.value;
    if (!token) {
        console.log("getAuthenticatedUser: No token found in cookies.");
        return null;
    }
    const decodedPayload = (0, jwt_1.verifyToken)(token);
    if (!decodedPayload || !decodedPayload.id) {
        console.log("getAuthenticatedUser: Invalid or decoded token payload.", decodedPayload);
        return null;
    }
    try {
        const { rows } = await db_1.db.query('SELECT * FROM users WHERE id = $1', [decodedPayload.id]);
        if (rows.length === 0) {
            console.log(`getAuthenticatedUser: User with id ${decodedPayload.id} not found.`);
            return null;
        }
        return (0, utils_1.formatUser)(rows[0]);
    }
    catch (error) {
        await (0, helpers_1.handleDbError)(error, 'getting authenticated user');
        return null;
    }
}
async function getAllUsers() {
    try {
        const { rows } = await db_1.db.query('SELECT * FROM users');
        return rows.map(utils_1.formatUser);
    }
    catch (error) {
        await (0, helpers_1.handleDbError)(error, 'getting all users');
        return [];
    }
}
async function checkContacts(phoneNumbers) {
    if (phoneNumbers.length === 0)
        return [];
    try {
        // Sanitize phone numbers - remove leading '+' and non-numeric characters
        const sanitizedNumbers = phoneNumbers.map(p => p.replace(/\D/g, '').slice(-9)); // Keep last 9 digits
        // Create a query with a condition for each phone number
        const conditions = sanitizedNumbers.map((_, i) => `phone LIKE $${i + 1}`).join(' OR ');
        const params = sanitizedNumbers.map(n => `%${n}`);
        const { rows } = await db_1.db.query(`SELECT id, full_name, profile_photo, phone FROM users WHERE ${conditions}`, params);
        const onChatUsers = new Map(rows.map(user => {
            const userPhoneSuffix = user.phone.slice(-9);
            return [userPhoneSuffix, { id: user.id, full_name: user.full_name, profile_photo: user.profile_photo }];
        }));
        return phoneNumbers.map(originalPhone => {
            const sanitized = originalPhone.replace(/\D/g, '').slice(-9);
            const user = onChatUsers.get(sanitized);
            return {
                phone: originalPhone,
                onChat: !!user,
                user: user
            };
        });
    }
    catch (error) {
        await (0, helpers_1.handleDbError)(error, 'checking contacts');
        return phoneNumbers.map(phone => ({ phone, onChat: false }));
    }
}
async function updateUser({ userId, updates }) {
    const connection = await db_1.db.getConnection();
    try {
        await connection.query('BEGIN');
        // Check if profile_photo or cover_photo are base64 and save them
        if (updates.profile_photo && updates.profile_photo.startsWith('data:image')) {
            const savedPath = await (0, helpers_1.saveBase64Image)(updates.profile_photo, 'avatars', `user_${userId}`);
            if (savedPath) {
                updates.profile_photo = savedPath;
            }
            else {
                delete updates.profile_photo; // Don't update if saving fails
            }
        }
        if (updates.cover_photo && updates.cover_photo.startsWith('data:image')) {
            const savedPath = await (0, helpers_1.saveBase64Image)(updates.cover_photo, 'covers', `user_${userId}`);
            if (savedPath) {
                updates.cover_photo = savedPath;
            }
            else {
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
        return { success: true, user: (0, utils_1.formatUser)(updatedUserRows[0]) };
    }
    catch (error) {
        await connection.query('ROLLBACK');
        const dbError = await (0, helpers_1.handleDbError)(error, 'updating user profile');
        return { success: false, error: dbError.error || error.message };
    }
    finally {
        connection.release();
    }
}
/**
 * Met à jour le code PIN de l'utilisateur et synchronise le changement avec ses cartes Marqeta.
 */
async function updatePin({ userId, oldPin, newPin }) {
    const connection = await db_1.db.getConnection();
    const headerList = (0, headers_1.headers)();
    const ipAddress = (headerList.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim();
    try {
        await connection.query('BEGIN');
        // 1. Vérifier l'ancien PIN
        const { rows: userRows } = await connection.query('SELECT pin_hash FROM users WHERE id = $1', [userId]);
        if (userRows.length === 0)
            throw new Error('Utilisateur non trouvé.');
        const user = userRows[0];
        if (!user.pin_hash)
            throw new Error('Aucun PIN configuré. Contactez le support.');
        const isMatch = await bcrypt.compare(oldPin, user.pin_hash);
        if (!isMatch)
            throw new Error('Votre ancien code PIN est incorrect.');
        // 2. Récupérer toutes les cartes actives pour synchronisation
        const { rows: cardRows } = await connection.query('SELECT id, marqeta_card_token FROM cards WHERE user_id = $1 AND status = $2', [userId, 'active']);
        // 3. Mettre à jour le PIN chez Marqeta pour chaque carte
        for (const card of cardRows) {
            if (card.marqeta_card_token) {
                // Marqeta nécessite une idempotencyKey unique par requête
                const idempotencyKey = crypto_1.default.randomUUID();
                await (0, marqeta_1.setCardPin)(card.marqeta_card_token, newPin, idempotencyKey, ipAddress);
            }
        }
        // 4. Mettre à jour le hash local dans la base CashPay
        const newHash = await bcrypt.hash(newPin, 10);
        await connection.query('UPDATE users SET pin_hash = $1 WHERE id = $2', [newHash, userId]);
        await connection.query('COMMIT');
        return { success: true };
    }
    catch (error) {
        await connection.query('ROLLBACK');
        console.error('[Update Pin Action] Critical error:', error.message);
        return { success: false, error: error.message };
    }
    finally {
        connection.release();
    }
}
async function savePushSubscription(userId, subscription) {
    try {
        const { endpoint } = subscription;
        await db_1.db.query('INSERT INTO push_subscriptions (user_id, endpoint, subscription_data) VALUES ($1, $2, $3) ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, subscription_data = $3', [userId, endpoint, JSON.stringify(subscription)]);
        return { success: true };
    }
    catch (error) {
        await (0, helpers_1.handleDbError)(error, 'saving push subscription');
        return { success: false };
    }
}
async function findUserByWalletId(walletId) {
    try {
        const { rows } = await db_1.db.query('SELECT * FROM users WHERE id_wallet = $1', [walletId]);
        if (rows.length === 0) {
            return null;
        }
        return (0, utils_1.formatUser)(rows[0]);
    }
    catch (error) {
        (0, helpers_1.handleDbError)(error, 'finding user by wallet id');
        return null;
    }
}
async function linkZoomAccount(userId, zoomId, refreshToken) {
    try {
        await db_1.db.query('UPDATE users SET zoom_id = $1, zoom_refresh_token = $2 WHERE id = $3', [zoomId, refreshToken, userId]);
        return { success: true };
    }
    catch (error) {
        const dbError = await (0, helpers_1.handleDbError)(error, 'linking Zoom account');
        return { success: false, error: dbError.error };
    }
}
async function findUserByZoomId(zoomId) {
    try {
        const { rows } = await db_1.db.query('SELECT * FROM users WHERE zoom_id = $1', [zoomId]);
        if (rows.length === 0) {
            return { success: false, error: 'Aucun compte CashPay n\'est associé à ce compte Zoom.' };
        }
        const user = (0, utils_1.formatUser)(rows[0]);
        const token = (0, jwt_1.generateToken)(user);
        return { success: true, user, token };
    }
    catch (error) {
        const dbError = await (0, helpers_1.handleDbError)(error, 'finding user by Zoom ID');
        return { success: false, error: dbError.error };
    }
}
async function getUserCounts(countryCode) {
    try {
        const { rows: totalRows } = await db_1.db.query('SELECT COUNT(*) FROM users');
        const totalUsers = totalRows[0].count;
        if (countryCode) {
            const countryInfo = countries_1.countries.find(c => c.code === countryCode);
            if (countryInfo) {
                const { rows: countryRows } = await db_1.db.query('SELECT COUNT(*) FROM users WHERE country = $1', [countryInfo.name]);
                return { totalUsers, countryUsers: countryRows[0].count };
            }
        }
        return { totalUsers, countryUsers: 0 };
    }
    catch (error) {
        (0, helpers_1.handleDbError)(error, 'getting user counts');
        return { totalUsers: 0, countryUsers: 0 };
    }
}
