'use server';

/**
 * @fileoverview A service for interacting with the Orange Money API.
 * NOTE: This is a template based on the Orange Money Senegal (Sonatel) documentation.
 * It requires real API credentials and potentially adjustments for other countries like DRC.
 * The currency used here is XOF, as per the Senegal API.
 */

const API_BASE_URL = process.env.ORANGE_MONEY_API_URL || 'https://api.orange.com';

interface ApiResponse {
  success: boolean;
  message: string;
  data?: any;
  paymentUrl?: string;
  payToken?: string;
}

/**
 * Retrieves an OAuth2 access token from the Orange Money API.
 * Credentials must be stored in the .env file.
 */
async function getAccessToken(): Promise<string> {
  const clientId = process.env.ORANGE_MONEY_CLIENT_ID;
  const clientSecret = process.env.ORANGE_MONEY_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId.includes('YOUR_CLIENT_ID')) {
    console.error('Orange Money API credentials are not configured in .env file.');
    throw new Error('Les identifiants pour l\'API Orange Money ne sont pas configurés.');
  }

  const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  
  try {
    const response = await fetch(`${API_BASE_URL}/oauth/v3/token`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      cache: 'no-store' // Important for token requests
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Orange Money Auth Error:', data);
      throw new Error(`Échec d'obtention du jeton d'accès: ${data.error_description || response.statusText}`);
    }

    return data.access_token;
  } catch (error) {
    console.error('Error fetching Orange Money access token:', error);
    throw error;
  }
}

/**
 * Initiates a payment request with the Orange Money API.
 * @param amount The amount to be paid.
 * @param currency The currency code (e.g., 'XOF' for Senegal).
 * @param fromPhoneNumber The phone number of the customer making the payment.
 * @returns A promise that resolves with the API response.
 */
export async function initiateOrangeMoneyDeposit(amount: number, currency: 'XOF', fromPhoneNumber: string): Promise<ApiResponse> {
  console.log(`Initiating Orange Money deposit for ${amount} ${currency} from ${fromPhoneNumber}`);
  try {
    const accessToken = await getAccessToken();
    const merchantKey = process.env.ORANGE_MONEY_MERCHANT_KEY;
    
    if (!merchantKey || merchantKey.includes('YOUR_MERCHANT_KEY')) {
        throw new Error('La clé marchand Orange Money (MERCHANT_KEY) n\'est pas configurée dans le fichier .env.');
    }

    // These URLs must be replaced with your actual application URLs.
    const returnUrl = 'https://your-app.com/deposit/success';
    const notifUrl = 'https://your-app.com/api/webhooks/orange-money';

    const payload = {
      merchant_key: merchantKey,
      currency: currency,
      order_id: `CASH PAY-DEPOSIT-${Date.now()}`,
      amount: amount,
      return_url: returnUrl,
      cancel_url: returnUrl, // Often the same as return_url
      notif_url: notifUrl,
      lang: 'fr',
      reference: 'CashPay App Deposit'
    };

    const response = await fetch(`${API_BASE_URL}/ompayment/v1/init`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (responseData.status !== 201) {
      console.error('Orange Money Payment Init Error:', responseData);
      throw new Error(responseData.message || 'Échec de l\'initialisation du paiement.');
    }
    
    console.log('Orange Money initiation successful:', responseData);
    return {
      success: true,
      message: 'Payment initiated successfully.',
      paymentUrl: responseData.payment_url,
      payToken: responseData.pay_token,
      data: responseData,
    };

  } catch (error: any) {
    console.error('Error initiating Orange Money deposit:', error);
    return {
      success: false,
      message: error.message || 'Une erreur inconnue est survenue lors de la transaction Orange Money.'
    };
  }
}
