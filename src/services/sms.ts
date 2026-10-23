'use server';

/**
 * @fileoverview A service for sending SMS messages using Dream Digital API.
 */

interface SmsResponse {
  success: boolean;
  message: string;
  messageId?: string;
}

/** Garde uniquement les chiffres : "+243 81 234 5678" -> "243812345678". */
function normalizePhone(phoneNumber: string): string {
  return String(phoneNumber ?? '').replace(/\D/g, '').replace(/^00/, '');
}

/**
 * Analyse la réponse de la passerelle. Ce type de passerelle répond souvent
 * "200 OK" même quand le SMS est refusé (identifiants, solde, expéditeur…) :
 * on ne considère donc plus tout HTTP 200 comme un succès.
 * Prudent par construction : seuls des signes CLAIRS d'échec sont détectés ;
 * une réponse inconnue reste un succès (comportement précédent).
 */
function readGatewayResponse(body: string): { ok: boolean; detail: string; messageId?: string } {
  const text = body.trim();

  try {
    const json = JSON.parse(text);
    const status = String(json?.status ?? json?.Status ?? json?.state ?? '').trim().toUpperCase();
    const detail = String(json?.remarks ?? json?.message ?? json?.error ?? json?.description ?? text).slice(0, 200);
    const messageId = json?.message_id ?? json?.messageId ?? json?.id;

    if (['F', 'FAILED', 'FAILURE', 'ERROR', 'E', 'REJECTED'].includes(status) || json?.error) {
      return { ok: false, detail };
    }

    return { ok: true, detail, messageId: messageId != null ? String(messageId) : undefined };
  } catch {
    // Réponse texte brut.
  }

  if (!text) {
    return { ok: true, detail: 'réponse vide' };
  }

  if (/\b(error|erreur|invalid|invalide|fail(?:ed|ure)?|insufficient|denied|unauthori[sz]ed|rejected|forbidden|blocked|not allowed)\b/i.test(text)) {
    return { ok: false, detail: text.slice(0, 200) };
  }

  return { ok: true, detail: text.slice(0, 200) };
}

/**
 * Sends an SMS message to a given phone number.
 * @param phoneNumber The recipient's phone number.
 * @param message The message to send.
 * @returns A promise that resolves with the SMS response.
 */
export async function sendSms(phoneNumber: string, message: string): Promise<SmsResponse> {
  const apiUrl = process.env.DREAM_DIGITAL_API_URL;
  const apiId = process.env.DREAM_DIGITAL_API_ID;
  const apiPassword = process.env.DREAM_DIGITAL_API_PASSWORD;
  const senderId = process.env.DREAM_DIGITAL_SENDER_ID || 'CashPay';

  if (!apiUrl || !apiId || !apiPassword || apiId.includes('YOUR_API_ID')) {
    const errorMessage = 'Dream Digital SMS API credentials are not configured.';
    console.error(`[SMS Service] ${errorMessage}`);
    return { success: false, message: 'Le service SMS est temporairement indisponible.' };
  }

  const recipient = normalizePhone(phoneNumber);

  if (recipient.length < 8) {
    console.error('[SMS Service] Numéro de téléphone invalide, SMS non envoyé.');
    return { success: false, message: 'Numéro de téléphone invalide.' };
  }

  const queryParams = new URLSearchParams({
    api_id: apiId,
    api_password: apiPassword,
    sms_type: 'T',
    encoding: 'T',
    sender_id: senderId,
    phonenumber: recipient,
    textmessage: message,
  });

  const fullUrl = `${apiUrl}?${queryParams.toString()}`;
  const maskedRecipient = `${recipient.slice(0, 4)}…${recipient.slice(-2)}`;

  // Sans délai maximum, une passerelle qui ne répond pas bloque tout l'écran
  // (connexion OTP, reçus…) indéfiniment.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    console.log(`[SMS Service] Sending SMS to ${maskedRecipient} via Dream Digital using GET.`);
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'CashPay/1.0',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    const textResponse = await response.text();
    console.log(`[SMS Service] Dream Digital API Response (HTTP ${response.status}): ${textResponse.slice(0, 300)}`);

    if (!response.ok) {
      return { success: false, message: `Failed to send SMS. Provider response: ${textResponse.slice(0, 200)}` };
    }

    const verdict = readGatewayResponse(textResponse);

    if (!verdict.ok) {
      console.error(`[SMS Service] La passerelle a répondu 200 mais refuse le SMS : ${verdict.detail}`);
      return { success: false, message: `Failed to send SMS. Provider response: ${verdict.detail}` };
    }

    return { success: true, message: 'SMS sent successfully.', messageId: verdict.messageId };
  } catch (error: any) {
    console.error('[SMS Service] Error calling Dream Digital API:', error);
    if (error?.name === 'AbortError' || error?.code === 'UND_ERR_CONNECT_TIMEOUT' || error?.name === 'TimeoutError') {
      return { success: false, message: 'Le service SMS est actuellement indisponible. Veuillez réessayer plus tard.' };
    }
    return { success: false, message: `An unexpected error occurred: ${error.message}` };
  } finally {
    clearTimeout(timer);
  }
}
