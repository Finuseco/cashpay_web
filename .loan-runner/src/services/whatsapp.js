'use server';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWhatsAppTextMessage = sendWhatsAppTextMessage;
const WHATSAPP_API_VERSION = 'v23.0';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
async function sendWhatsAppTextMessage(to, text) {
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
        console.warn('[WhatsApp Service] Configuration Meta WhatsApp Cloud API absente.');
        return {
            success: false,
            message: 'WhatsApp Cloud API non configurée.'
        };
    }
    const sanitizedNumber = to.replace(/\D/g, '');
    if (!sanitizedNumber) {
        return {
            success: false,
            message: 'Numéro WhatsApp invalide.'
        };
    }
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/` +
        `${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: sanitizedNumber,
        type: 'text',
        text: {
            preview_url: false,
            body: text
        }
    };
    try {
        console.log(`[WhatsApp Service] Envoi via Meta Cloud API vers ${sanitizedNumber}...`);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            cache: 'no-store'
        });
        const responseData = await response.json();
        if (!response.ok) {
            console.error('[WhatsApp Service] Erreur Meta Cloud API:', responseData);
            return {
                success: false,
                message: responseData?.error?.message ||
                    "Échec de l'envoi du message WhatsApp.",
                data: responseData
            };
        }
        console.log(`[WhatsApp Service] Message envoyé avec succès à ${sanitizedNumber}.`);
        return {
            success: true,
            message: 'Message WhatsApp envoyé avec succès.',
            data: responseData
        };
    }
    catch (error) {
        console.error('[WhatsApp Service] Erreur lors de l’appel Meta Cloud API:', error);
        return {
            success: false,
            message: error?.message || "Erreur inattendue lors de l'envoi WhatsApp."
        };
    }
}
