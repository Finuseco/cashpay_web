'use server';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiateMpesaDeposit = initiateMpesaDeposit;
exports.sendToMpesa = sendToMpesa;
exports.payMpesaB2B = payMpesaB2B;
exports.queryTransactionStatus = queryTransactionStatus;
exports.verifyMpesaAccountHolder = verifyMpesaAccountHolder;
exports.reverseMpesaTransaction = reverseMpesaTransaction;
exports.updateMpesaTransactionStatus = updateMpesaTransactionStatus;
const encryption_1 = require("@/lib/encryption");
const MPESA_API_URL_PRODUCTION = process.env.MPESA_API_URL_PRODUCTION || 'https://api.safaricom.co.ke';
const MPESA_API_URL_SANDBOX = process.env.MPESA_API_URL_SANDBOX || 'https://openapi.m-pesa.com';
const MPESA_API_URL = process.env.NODE_ENV === 'production' ? MPESA_API_URL_PRODUCTION : MPESA_API_URL_SANDBOX;
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const MPESA_BUSINESS_SHORTCODE = process.env.MPESA_BUSINESS_SHORTCODE;
const MPESA_PASSKEY = process.env.MPESA_PASSKEY;
const MPESA_INITIATOR_NAME = process.env.MPESA_INITIATOR_NAME;
const MPESA_INITIATOR_PASSWORD = process.env.MPESA_INITIATOR_PASSWORD;
const MPESA_PUBLIC_KEY = process.env.MPESA_ENCRYPTION_PUBLIC_KEY;
// M-Pesa Sandbox Test Numbers
const MOCK_C2B_NUMBERS = {
    'SUCCESS': '000000000001',
    'TIMEOUT': '000000000002',
    'USSD_TIMEOUT': '000000000003',
    'WRONG_PIN': '000000000004',
    'INTERNAL_ERROR': '000000000005',
    'INVALID_AMOUNT': '000000000007',
    'INSUFFICIENT_FUNDS': '000000000008',
    'UNAVAILABLE': '000000000009',
};
const MOCK_B2C_NUMBERS = {
    'SUCCESS': '000000000001',
    'INTERNAL_ERROR': '000000000002',
    'FAILED': '000000000003',
    'TIMEOUT': '000000000004',
    'INVALID_AMOUNT': '000000000005',
    'INSUFFICIENT_FUNDS': '000000000006',
    'UNAVAILABLE': '000000000007',
};
function getTestMsisdn(phoneNumber, type) {
    if (process.env.NODE_ENV === 'production') {
        return phoneNumber;
    }
    const testNumbers = type === 'C2B' ? MOCK_C2B_NUMBERS : MOCK_B2C_NUMBERS;
    // A simple way to trigger different scenarios during testing
    // e.g., a phone number ending in 8 triggers INSUFFICIENT_FUNDS
    const lastDigit = phoneNumber.slice(-1);
    switch (lastDigit) {
        case '1': return testNumbers['SUCCESS'];
        case '2': return testNumbers['TIMEOUT'] || testNumbers['FAILED'];
        case '3': return testNumbers['FAILED'] || testNumbers['USSD_TIMEOUT'];
        case '4': return testNumbers['WRONG_PIN'] || testNumbers['TIMEOUT'];
        case '5': return testNumbers['INTERNAL_ERROR'];
        case '7': return testNumbers['INVALID_AMOUNT'];
        case '8': return testNumbers['INSUFFICIENT_FUNDS'];
        case '9': return testNumbers['UNAVAILABLE'];
        default: return testNumbers['SUCCESS'];
    }
}
async function getEncryptedSessionKey(market) {
    const apiKey = process.env.MPESA_API_KEY;
    const publicKey = process.env.MPESA_ENCRYPTION_PUBLIC_KEY;
    if (!apiKey || !publicKey || apiKey.includes('YOUR_KEY')) {
        console.log("[M-Pesa Service] Using mock session key generation.");
        return "mock_encrypted_session_key";
    }
    const response = await fetch(`${MPESA_API_URL}/sandbox/ipg/v2/${market}/getSession/`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Origin': '*' // Adjust for production
        }
    });
    const data = await response.json();
    if (!response.ok || !data.output_SessionID) {
        console.error("M-Pesa getSession Error:", data);
        throw new Error("Échec de la récupération de la clé de session M-Pesa.");
    }
    return (0, encryption_1.encryptWithPublicKey)(data.output_SessionID, publicKey);
}
async function initiateMpesaDeposit(args) {
    const { amount, currency, phoneNumber, user, reference } = args;
    const market = 'vodacomDRC'; // Hardcoded for DRC
    const country = 'RDC';
    if (!MPESA_BUSINESS_SHORTCODE) {
        return { success: false, message: "M-Pesa service is not properly configured." };
    }
    try {
        const encryptedSessionKey = await getEncryptedSessionKey(market);
        const thirdPartyConvId = `CASH PAY_CONV_${Date.now()}`;
        const testPhoneNumber = getTestMsisdn(phoneNumber, 'C2B');
        const payload = {
            input_Amount: amount,
            input_Country: country,
            input_Currency: currency,
            input_CustomerMSISDN: testPhoneNumber,
            input_ServiceProviderCode: MPESA_BUSINESS_SHORTCODE,
            input_TransactionReference: reference,
            input_ThirdPartyConversationID: thirdPartyConvId,
            input_PurchasedItemsDesc: `Deposit to CashPay wallet ${user.id_wallet}`,
            input_APIVersion: "3.1"
        };
        console.log(`[M-Pesa C2B Multi-Stage] Initiating for ${testPhoneNumber}. Reference: ${reference}`);
        const response = await fetch(`${MPESA_API_URL}/sandbox/ipg/v2/${market}/c2bPayment/multiStage/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${encryptedSessionKey}`,
                'Content-Type': 'application/json',
                'Origin': '*' // Restrict in production
            },
            body: JSON.stringify(payload)
        });
        const responseData = await response.json();
        if (responseData.output_ResponseCode === "INS-0") {
            return {
                success: true,
                message: "Demande de paiement envoyée. Veuillez entrer votre PIN M-Pesa pour confirmer.",
                data: responseData
            };
        }
        else {
            console.error('M-Pesa C2B Multi-Stage Error:', responseData);
            return { success: false, message: responseData.output_ResponseDesc || 'Une erreur est survenue avec le service M-Pesa.' };
        }
    }
    catch (error) {
        console.error("[M-Pesa C2B Multi-Stage] Critical API call error:", error);
        return { success: false, message: error.message || 'Une erreur de communication est survenue avec M-Pesa.' };
    }
}
async function sendToMpesa(args) {
    const { amount, currency, recipientPhone, recipientName, reference } = args;
    const market = 'vodacomDRC';
    const country = 'RDC';
    if (!MPESA_BUSINESS_SHORTCODE) {
        return { success: false, message: "M-Pesa B2C service is not properly configured." };
    }
    try {
        const encryptedSessionKey = await getEncryptedSessionKey(market);
        const thirdPartyConvId = `CASH PAY_PAYOUT_${Date.now()}`;
        const testPhoneNumber = getTestMsisdn(recipientPhone, 'B2C');
        const payload = {
            input_Amount: amount,
            input_Country: country,
            input_Currency: currency,
            input_CustomerMSISDN: testPhoneNumber,
            input_ServiceProviderCode: MPESA_BUSINESS_SHORTCODE,
            input_TransactionReference: reference,
            input_ThirdPartyConversationID: thirdPartyConvId,
            input_PaymentItemsDesc: `CashPay Payout to ${recipientName}`,
        };
        console.log(`[M-Pesa B2C] Initiating Payout for ${testPhoneNumber}. Reference: ${reference}`);
        const response = await fetch(`${MPESA_API_URL}/sandbox/ipg/v2/${market}/b2cPayment/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${encryptedSessionKey}`,
                'Content-Type': 'application/json',
                'Origin': '*',
            },
            body: JSON.stringify(payload),
        });
        const responseData = await response.json();
        if (responseData.output_ResponseCode === "INS-0") {
            return {
                success: true,
                message: "Payout request sent to M-Pesa successfully.",
                data: responseData
            };
        }
        else {
            console.error('M-Pesa B2C Error:', responseData);
            return { success: false, message: responseData.output_ResponseDesc || 'Une erreur est survenue avec le service M-Pesa.' };
        }
    }
    catch (error) {
        console.error("[M-Pesa B2C] Critical API call error:", error);
        return { success: false, message: error.message || 'An error occurred during M-Pesa B2C Payout.' };
    }
}
async function payMpesaB2B(args) {
    const { amount, currency, recipientShortCode, description, reference } = args;
    const market = 'vodacomDRC';
    const country = 'RDC';
    if (!MPESA_BUSINESS_SHORTCODE) {
        return { success: false, message: "Le service de paiement M-Pesa B2B n'est pas configuré." };
    }
    try {
        const encryptedSessionKey = await getEncryptedSessionKey(market);
        const thirdPartyConvId = `CP_B2B_${Date.now()}`;
        const testRecipientCode = process.env.NODE_ENV === 'production' ? recipientShortCode : '000001';
        const payload = {
            input_Amount: amount,
            input_Country: country,
            input_Currency: currency,
            input_PrimaryPartyCode: MPESA_BUSINESS_SHORTCODE,
            input_ReceiverPartyCode: testRecipientCode,
            input_ThirdPartyConversationID: thirdPartyConvId,
            input_TransactionReference: reference,
            input_PurchasedItemsDesc: description,
        };
        console.log(`[M-Pesa B2B] Initiating payment to ${testRecipientCode}. Reference: ${reference}`);
        const response = await fetch(`${MPESA_API_URL}/sandbox/ipg/v2/${market}/b2bPayment/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${encryptedSessionKey}`,
                'Content-Type': 'application/json',
                'Origin': '*',
            },
            body: JSON.stringify(payload),
        });
        const responseData = await response.json();
        if (responseData.output_ResponseCode === "INS-0") {
            return {
                success: true,
                message: "La demande de paiement B2B a été envoyée avec succès à M-Pesa.",
                data: responseData,
            };
        }
        else {
            console.error('M-Pesa B2B Error:', responseData);
            return { success: false, message: responseData.output_ResponseDesc || 'Une erreur est survenue avec le service M-Pesa.' };
        }
    }
    catch (error) {
        console.error("[M-Pesa B2B] Critical API call error:", error);
        return { success: false, message: error.message || 'Une erreur de communication est survenue avec M-Pesa.' };
    }
}
async function queryTransactionStatus(ourReference) {
    const market = 'vodacomDRC';
    if (!MPESA_BUSINESS_SHORTCODE) {
        return { success: false, message: "M-Pesa service is not properly configured." };
    }
    try {
        const encryptedSessionKey = await getEncryptedSessionKey(market);
        const thirdPartyConversationID = `query_${Date.now()}`;
        const queryReference = process.env.NODE_ENV === 'production' ? ourReference : '000000000000000000001';
        const queryParams = new URLSearchParams({
            input_QueryReference: queryReference,
            input_ServiceProviderCode: MPESA_BUSINESS_SHORTCODE,
            input_ThirdPartyConversationID: thirdPartyConversationID,
            input_Country: 'RDC',
        });
        const response = await fetch(`${MPESA_API_URL}/sandbox/ipg/v2/${market}/queryTransactionStatus?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${encryptedSessionKey}`,
                'Origin': '*',
            }
        });
        const data = await response.json();
        if (data && data.output_ResponseCode === 'INS-0') {
            return { success: true, message: 'La demande de vérification de statut a été envoyée.', data: data };
        }
        else {
            return { success: false, message: data.output_ResponseDesc || 'Impossible de vérifier le statut pour cette référence.' };
        }
    }
    catch (error) {
        console.error("[M-Pesa Status Query] Critical API call error:", error);
        return { success: false, message: error.message || 'An error occurred during status query.' };
    }
}
async function verifyMpesaAccountHolder(phoneNumber, country = 'vodacomDRC') {
    try {
        const encryptedSessionKey = await getEncryptedSessionKey(country);
        const thirdPartyConversationID = `verify_${Date.now()}`;
        const testPhoneNumber = getTestMsisdn(phoneNumber, 'C2B');
        const queryParams = new URLSearchParams({
            input_CustomerMSISDN: testPhoneNumber,
            input_Country: 'RDC',
            input_ServiceProviderCode: MPESA_BUSINESS_SHORTCODE || '000000',
            input_ThirdPartyConversationID: thirdPartyConversationID,
            input_KycQueryType: 'Name'
        });
        const response = await fetch(`${MPESA_API_URL}/sandbox/ipg/v2/${country}/queryBeneficiaryName?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${encryptedSessionKey}`,
                'Origin': '*', // Should be restricted in production
            }
        });
        const data = await response.json();
        if (data && data.output_ResponseCode === 'INS-0') {
            const name = `${data.output_CustomerFirstName} ${data.output_CustomerLastName}`;
            return { success: true, name };
        }
        else {
            console.error('M-Pesa Verification Error:', data.output_ResponseDesc);
            return { success: false, error: data.output_ResponseDesc || 'Ce numéro n\'est pas un compte M-Pesa valide.' };
        }
    }
    catch (error) {
        console.error('[M-Pesa User Enquiry] Critical error:', error);
        return { success: false, error: 'Une erreur de communication est survenue avec le service M-Pesa.' };
    }
}
/**
 * Reverses a previously successful transaction.
 * @param transactionId - The `output_TransactionID` from the original transaction response.
 * @returns A promise that resolves with the API response.
 */
async function reverseMpesaTransaction(transactionId) {
    const market = 'vodacomDRC';
    if (!MPESA_BUSINESS_SHORTCODE) {
        return { success: false, message: "M-Pesa service is not properly configured." };
    }
    try {
        const encryptedSessionKey = await getEncryptedSessionKey(market);
        const thirdPartyConvId = `reversal_${Date.now()}`;
        const testTransactionId = process.env.NODE_ENV === 'production' ? transactionId : '0000000000001';
        const payload = {
            input_Country: 'RDC',
            input_ServiceProviderCode: MPESA_BUSINESS_SHORTCODE,
            input_TransactionID: testTransactionId,
            input_ThirdPartyConversationID: thirdPartyConvId,
        };
        const response = await fetch(`${MPESA_API_URL}/sandbox/ipg/v2/${market}/reversal/`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${encryptedSessionKey}`,
                'Content-Type': 'application/json',
                'Origin': '*',
            },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (data.output_ResponseCode === 'INS-0') {
            return { success: true, message: 'Reversal request processed successfully.', data };
        }
        else {
            return { success: false, message: data.output_ResponseDesc || 'Failed to process reversal.' };
        }
    }
    catch (error) {
        console.error("[M-Pesa Reversal] Critical API call error:", error);
        return { success: false, message: error.message || 'An error occurred during transaction reversal.' };
    }
}
/**
 * Commits or rolls back a multi-stage transaction.
 * @param action - 'commit' to finalize the transaction, 'rollback' to cancel.
 * @param transactionId - The `output_TransactionID` from the initial C2B multi-stage call.
 * @returns A promise that resolves with the API response.
 */
async function updateMpesaTransactionStatus(action, transactionId) {
    const market = 'vodacomDRC';
    if (!MPESA_BUSINESS_SHORTCODE) {
        return { success: false, message: "M-Pesa service is not properly configured." };
    }
    try {
        const encryptedSessionKey = await getEncryptedSessionKey(market);
        const thirdPartyConvId = `update_${action}_${Date.now()}`;
        const testTransactionId = process.env.NODE_ENV === 'production' ? transactionId : '0000000000001';
        // Note: The documentation states input_CustomerMSISDN should be 1 for commit, 0 for rollback.
        // This seems unusual but we will follow the spec.
        const payload = {
            input_Country: 'RDC',
            input_CustomerMSISDN: action === 'commit' ? '1' : '0',
            input_ServiceProviderCode: MPESA_BUSINESS_SHORTCODE,
            input_ThirdPartyConversationID: thirdPartyConvId,
            input_TransactionID: testTransactionId,
            input_APIVersion: "3.1"
        };
        console.log(`[M-Pesa Update Status] Action: ${action} for Transaction ID: ${testTransactionId}`);
        const response = await fetch(`${MPESA_API_URL}/sandbox/ipg/v2/${market}/updateTransactionStatus/`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${encryptedSessionKey}`,
                'Content-Type': 'application/json',
                'Origin': '*',
            },
            body: JSON.stringify(payload),
        });
        const responseData = await response.json();
        if (responseData.output_ResponseCode === "INS-GAR-0") {
            return { success: true, message: `Transaction status update (${action}) processed successfully.`, data: responseData };
        }
        else {
            console.error(`M-Pesa Update Status Error (${action}):`, responseData);
            return { success: false, message: responseData.output_ResponseDesc || 'Failed to update transaction status.' };
        }
    }
    catch (error) {
        console.error(`[M-Pesa Update Status] Critical API call error for action ${action}:`, error);
        return { success: false, message: error.message || `An error occurred during ${action}.` };
    }
}
