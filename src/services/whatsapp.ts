'use server';

interface WhatsAppResponse {
  success: boolean;
  message: string;
  data?: any;
}

const WHATSAPP_API_VERSION = 'v23.0';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

export async function sendWhatsAppTextMessage(
  to: string,
  text: string
): Promise<WhatsAppResponse> {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.warn(
      '[WhatsApp Service] Configuration Meta WhatsApp Cloud API absente.'
    );
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

  const url =
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/` +
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
    console.log(
      `[WhatsApp Service] Envoi via Meta Cloud API vers ${sanitizedNumber}...`
    );

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
      console.error(
        '[WhatsApp Service] Erreur Meta Cloud API:',
        responseData
      );

      return {
        success: false,
        message:
          responseData?.error?.message ||
          "Échec de l'envoi du message WhatsApp.",
        data: responseData
      };
    }

    console.log(
      `[WhatsApp Service] Message envoyé avec succès à ${sanitizedNumber}.`
    );

    return {
      success: true,
      message: 'Message WhatsApp envoyé avec succès.',
      data: responseData
    };
  } catch (error: any) {
    console.error(
      '[WhatsApp Service] Erreur lors de l’appel Meta Cloud API:',
      error
    );

    return {
      success: false,
      message:
        error?.message || "Erreur inattendue lors de l'envoi WhatsApp."
    };
  }
}

/** Sends an approved Meta authentication template; never falls back to an unsolicited text OTP. */
export async function sendWhatsAppAuthenticationTemplate(to: string, otp: string): Promise<WhatsAppResponse> {
  const template = process.env.WHATSAPP_AUTH_TEMPLATE_NAME;
  const language = process.env.WHATSAPP_AUTH_TEMPLATE_LANGUAGE || 'fr';
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN || !template) return { success: false, message: 'Modèle WhatsApp d’authentification non configuré.' };
  const recipient = to.replace(/\D/g, '');
  if (!recipient || !/^\d{4,8}$/.test(otp)) return { success: false, message: 'Destinataire ou code invalide.' };
  try {
    const response = await fetch(`https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ messaging_product: 'whatsapp', to: recipient, type: 'template', template: { name: template, language: { code: language },
        components: [{ type: 'body', parameters: [{ type: 'text', text: otp }] }, { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otp }] }] } })
    });
    const result = await response.json();
    return { success: response.ok && Boolean(result.messages?.[0]?.id), message: response.ok ? 'Code accepté par WhatsApp.' : 'Envoi WhatsApp refusé.' };
  } catch { return { success: false, message: 'Service WhatsApp indisponible.' }; }
}
