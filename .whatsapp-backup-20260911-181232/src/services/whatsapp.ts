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

export async function sendWhatsAppAuthenticationTemplate(
  to: string,
  otp: string
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

  const templateName =
    process.env.WHATSAPP_AUTH_TEMPLATE_NAME ||
    'authentication_code_copy_code_button';

  const languageCode =
    process.env.WHATSAPP_AUTH_TEMPLATE_LANGUAGE ||
    'fr_FR';

  const url =
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/` +
    `${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: sanitizedNumber,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: [
        {
          type: 'body',
          parameters: [
            {
              type: 'text',
              text: otp
            }
          ]
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            {
              type: 'text',
              text: otp
            }
          ]
        }
      ]
    }
  };

  try {
    console.log(
      `[WhatsApp Service] Envoi du template Authentication à ${sanitizedNumber}...`
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
        '[WhatsApp Service] Erreur Meta Authentication Template:',
        responseData
      );

      return {
        success: false,
        message:
          responseData?.error?.message ||
          "Échec de l'envoi du code WhatsApp.",
        data: responseData
      };
    }

    console.log(
      `[WhatsApp Service] Authentication Template envoyé avec succès à ${sanitizedNumber}.`
    );

    return {
      success: true,
      message: 'Code WhatsApp envoyé avec succès.',
      data: responseData
    };
  } catch (error: any) {
    console.error(
      '[WhatsApp Service] Erreur Authentication Template:',
      error
    );

    return {
      success: false,
      message:
        error?.message ||
        "Erreur inattendue lors de l'envoi du code WhatsApp."
    };
  }
}

export async function sendWhatsAppUtilityTemplate(
  to: string,
  bodyParameters: string[]
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

  const templateName =
    process.env.WHATSAPP_TRANSACTION_SENT_TEMPLATE_NAME ||
    'cashpay_transaction_sent';

  const languageCode =
    process.env.WHATSAPP_TRANSACTION_TEMPLATE_LANGUAGE ||
    'fr_FR';

  const url =
    `https://graph.facebook.com/${WHATSAPP_API_VERSION}/` +
    `${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: sanitizedNumber,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: [
        {
          type: 'body',
          parameters: bodyParameters.map((value) => ({
            type: 'text',
            text: value
          }))
        }
      ]
    }
  };

  try {
    console.log(
      `[WhatsApp Service] Envoi du template Utility à ${sanitizedNumber}...`
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
        '[WhatsApp Service] Erreur Meta Utility Template:',
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
      `[WhatsApp Service] Utility Template envoyé avec succès à ${sanitizedNumber}.`
    );

    return {
      success: true,
      message: 'Message WhatsApp envoyé avec succès.',
      data: responseData
    };
  } catch (error: any) {
    console.error(
      '[WhatsApp Service] Erreur Utility Template:',
      error
    );

    return {
      success: false,
      message:
        error?.message ||
        "Erreur inattendue lors de l'envoi WhatsApp."
    };
  }
}
