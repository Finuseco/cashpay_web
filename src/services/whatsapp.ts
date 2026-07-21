'use server';

/**
 * @fileoverview Service de messagerie via l'API WhatChimp.
 * Spécialisé pour l'envoi de notifications, alertes et codes OTP.
 * Documentation : https://help.whatchimp.com/docs/whatchimp-apis/whatchimp-messaging-api
 */

interface WhatsAppResponse {
  success: boolean;
  message: string;
  data?: any;
}

const WHATCHIMP_API_URL = 'https://api.whatchimp.com/v1/send-message';
const WHATCHIMP_API_KEY = process.env.WHATCHIMP_API_KEY;

/**
 * Envoie un message textuel via WhatChimp.
 * 
 * @param to Le numéro de téléphone du destinataire au format international (ex: 243853868021).
 * @param text Le contenu du message.
 * @returns Une promesse résolue avec le statut de l'envoi.
 */
export async function sendWhatsAppTextMessage(to: string, text: string): Promise<WhatsAppResponse> {
  
  // 1. Vérification de la configuration
  if (!WHATCHIMP_API_KEY || WHATCHIMP_API_KEY === 'YOUR_API_KEY') {
    const errorMessage = 'Clé API WhatChimp non configurée dans le fichier .env.';
    console.warn(`[WhatsApp Service] ${errorMessage}`);
    
    // Fallback console pour le développement
    console.log("--- MOCK WHATCHIMP ---");
    console.log(`Destinataire : ${to}`);
    console.log(`Message : ${text}`);
    console.log("----------------------");
    
    return { success: true, message: 'Message simulé (Clé API manquante).' };
  }

  // 2. Formatage du numéro (WhatChimp attend des chiffres uniquement)
  const sanitizedNumber = to.replace(/\D/g, '');

  // 3. Optimisation pour OTP (Press to copy)
  // Si le message contient un code à 6 chiffres, on s'assure qu'il est bien mis en évidence
  let finalMessage = text;
  if (text.includes('code') || text.includes('OTP')) {
      // On ajoute des sauts de ligne pour isoler le code et faciliter la copie sur mobile
      finalMessage = text.replace(/(\d{6})/, '\n\n*$1*\n\n');
  }

  const payload = {
    receiver: sanitizedNumber,
    message: finalMessage,
  };
  
  try {
    console.log(`[WhatsApp Service] Envoi via WhatChimp vers ${sanitizedNumber}...`);
    
    const response = await fetch(WHATCHIMP_API_URL, {
      method: 'POST',
      headers: {
        'X-API-Key': WHATCHIMP_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      cache: 'no-store'
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('[WhatsApp Service] Erreur API WhatChimp :', responseData);
      return { 
        success: false, 
        message: responseData.message || responseData.error || 'Échec de l\'envoi du message WhatsApp.' 
      };
    }

    console.log(`[WhatsApp Service] Message envoyé avec succès à ${sanitizedNumber}.`);
    return { success: true, message: 'Message envoyé avec succès.', data: responseData };

  } catch (error: any) {
    console.error('[WhatsApp Service] Erreur critique lors de l\'appel API :', error);
    return { success: false, message: `Une erreur inattendue est survenue : ${error.message}` };
  }
}
