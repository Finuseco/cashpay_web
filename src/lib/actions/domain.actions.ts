
'use server';

import type { User } from '../types';
import { createTransaction } from './transaction.actions';

// This is a new function to simulate fetching domains for a user
export async function getDomainsForUser(userId: number): Promise<{ success: boolean; data?: any[]; error?: string }> {
    console.log(`[Domain Action] Simulating fetch for domains of user ${userId}`);
    // In a real app, this would be: SELECT * FROM domains WHERE user_id = ?
    await new Promise(resolve => setTimeout(resolve, 500));
    // Mock data, to be replaced by a database query
    const mockDomains = [
        { name: 'cashpay.africa', expires: '2025-07-15', status: 'active' },
        { name: 'finuseco.org', expires: '2024-09-01', status: 'expiring' },
    ];
    return { success: true, data: mockDomains };
}


/**
 * Checks the availability of a domain name using the eNom API.
 * 
 * @param domain The full domain name to check (e.g., "cashpay.com").
 * @returns A promise that resolves to an object indicating availability.
 */
export async function checkDomainAvailability(domain: string): Promise<{ available: boolean }> {
  console.log(`[eNom Action] Checking availability for: ${domain}`);

  const uid = process.env.ENOM_USERNAME;
  const token = process.env.ENOM_TOKEN;

  if (!uid || !token || uid.includes('YOUR_USERNAME')) {
    console.error("[eNom Action] eNom API credentials are not configured in .env file. Using mock logic.");
    // Fallback to more realistic mock logic if credentials are not set.
    const takenDomains = ['google.com', 'facebook.com', 'cashpay.africa', 'finuseco.org'];
    const isTaken = takenDomains.some(d => domain.toLowerCase().includes(d)) || domain.startsWith('taken');
    return { available: !isTaken };
  }

  const parts = domain.split('.');
  if (parts.length < 2) {
    console.error(`[eNom Action] Invalid domain format: ${domain}`);
    return { available: false };
  }
  const sld = parts.slice(0, -1).join('.');
  const tld = parts.slice(-1)[0];

  const apiUrl = `https://reseller.enom.com/interface.asp?command=check&uid=${uid}&pw=${token}&tld=${tld}&sld=${sld}&ResponseType=XML`;

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' });
    const xmlText = await response.text();
    console.log(`[eNom Action] API Response for ${domain}:\n`, xmlText);
    const rrpCodeMatch = xmlText.match(/<RRPCode>(\d+)<\/RRPCode>/);
    if (rrpCodeMatch && rrpCodeMatch[1]) {
      const rrpCode = rrpCodeMatch[1];
      if (rrpCode === '210') {
        return { available: true };
      }
      return { available: false };
    }
    return { available: false };

  } catch (error) {
    console.error(`[eNom Action] API call failed for ${domain}:`, error);
    return { available: false };
  }
}

/**
 * Adds a domain registration to the eNom shopping cart.
 */
export async function addDomainToCart(domain: string, years: number, user: User): Promise<{ success: boolean; error?: string }> {
  console.log(`[eNom Action] Adding ${domain} to cart for ${years} year(s).`);

  const uid = process.env.ENOM_USERNAME;
  const token = process.env.ENOM_TOKEN;

  if (!uid || !token) {
    return { success: false, error: "eNom API credentials are not configured." };
  }
  
  const parts = domain.split('.');
  if (parts.length < 2) {
    return { success: false, error: "Invalid domain format." };
  }
  const sld = parts.slice(0, -1).join('.');
  const tld = parts.slice(-1)[0];

  const queryParams = new URLSearchParams({
    Command: 'AddToCart',
    uid,
    pw: token,
    ProductType: 'register',
    TLD: tld,
    SLD: sld,
    Quantity: years.toString(),
    RegistrantFirstName: user.first_name || 'John',
    RegistrantLastName: user.last_name || 'Doe',
    RegistrantAddress1: user.address || '123 Main St',
    RegistrantCity: user.city || 'Kinshasa',
    RegistrantStateProvince: 'Kinshasa',
    RegistrantPostalCode: '10000',
    RegistrantCountry: user.country || 'CD',
    RegistrantPhone: `+${user.phone}` || '+243853868021',
    RegistrantEmailAddress: user.email || 'contact@cashpay.cd',
    ResponseType: 'XML'
  });

  for (const contactType of ['Admin', 'Tech', 'AuxBilling']) {
    queryParams.set(`${contactType}FirstName`, user.first_name || 'John');
    queryParams.set(`${contactType}LastName`, user.last_name || 'Doe');
    queryParams.set(`${contactType}Address1`, user.address || '123 Main St');
    queryParams.set(`${contactType}City`, user.city || 'Kinshasa');
    queryParams.set(`${contactType}StateProvince`, 'Kinshasa');
    queryParams.set(`${contactType}PostalCode`, '10000');
    queryParams.set(`${contactType}Country`, user.country || 'CD');
    queryParams.set(`${contactType}Phone`, `+${user.phone}` || '+243853868021');
    queryParams.set(`${contactType}EmailAddress`, user.email || 'contact@cashpay.cd');
  }

  const apiUrl = `https://reseller.enom.com/interface.asp?${queryParams.toString()}`;

  try {
    const response = await fetch(apiUrl, { cache: 'no-store' });
    const xmlText = await response.text();
    console.log('[eNom AddToCart Response]', xmlText);

    const isDone = xmlText.includes('<Done>true</Done>');
    if (isDone) {
      console.log(`[eNom Action] ${domain} successfully added to cart. Next step: Purchase.`);
      return { success: true };
    } else {
      const errorMsg = xmlText.match(/<Err1>(.*?)<\/Err1>/)?.[1] || 'Unknown error adding to cart.';
      return { success: false, error: errorMsg };
    }
  } catch (error: any) {
    console.error(`[eNom Action] AddToCart API call failed for ${domain}:`, error);
    return { success: false, error: 'Failed to communicate with domain registrar.' };
  }
}


/**
 * Purchases items from the eNom shopping cart and debits the user's wallet.
 */
export async function purchaseDomain(user: User, domain: string, years: number, price: number): Promise<{ success: boolean; error?: string }> {
  const uid = process.env.ENOM_USERNAME;
  const token = process.env.ENOM_TOKEN;

  if (!uid || !token) {
    return { success: false, error: "eNom API credentials are not configured." };
  }

  // 1. Debit user's wallet first
  const transactionResult = await createTransaction({
      user,
      typeCode: 'DOMAIN_BUY',
      amount: price,
      currency: 'USD',
      description: `Achat du domaine ${domain} pour ${years} an(s).`,
      metadata: { domain, years }
  });

  if (!transactionResult.success) {
      return { success: false, error: transactionResult.error || "Échec du paiement pour l'achat du domaine." };
  }

  // 2. If payment is successful, execute the purchase on eNom
  const apiUrl = `https://reseller.enom.com/interface.asp?command=Purchase&uid=${uid}&pw=${token}&ResponseType=XML`;
  
  try {
      const response = await fetch(apiUrl, { cache: 'no-store' });
      const xmlText = await response.text();
      console.log('[eNom Purchase Response]', xmlText);

      const isDone = xmlText.includes('<Done>true</Done>');
      if (isDone) {
          console.log(`[eNom Action] Domain purchase successful for ${domain}.`);
          // Here, you would also save the domain ownership details into your own database.
          return { success: true };
      } else {
          const errorMsg = xmlText.match(/<Err1>(.*?)<\/Err1>/)?.[1] || 'Unknown error during purchase.';
          console.error(`[eNom Action] Purchase failed for ${domain}: ${errorMsg}`);
          // TODO: Implement transaction reversal logic here because the user was debited but the purchase failed.
          return { success: false, error: errorMsg };
      }

  } catch (error: any) {
      console.error(`[eNom Action] Purchase API call failed for ${domain}:`, error);
      // TODO: Reversal logic is also needed here.
      return { success: false, error: 'Failed to communicate with domain registrar during final purchase.' };
  }
}



/**
 * Gets information about a registered domain.
 * This is a placeholder.
 */
export async function getDomainInfo(domain: string) {
    console.log(`[Domain Action] Simulating fetch for domain info: ${domain}.`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
        success: true,
        data: {
            domainName: domain,
            status: 'active',
            registrarLock: true,
            expires: '2025-07-25',
            autoRenew: false,
            dnsRecords: [
                { type: 'A', name: '@', value: '76.76.21.21', ttl: 3600 },
                { type: 'CNAME', name: 'www', value: domain, ttl: 3600 },
            ],
            redirects: []
        }
    };
}

/**
 * Updates DNS records for a domain.
 * This is a placeholder.
 */
export async function updateDnsRecords(domain: string, records: any[]) {
    console.log(`[Domain Action] Simulating update of DNS records for ${domain}:`, records);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true };
}

/**
 * Purchases an SSL certificate.
 * This is a placeholder.
 */
export async function purchaseSslCertificate(domain: string, type: string) {
    console.log(`[Domain Action] Simulating purchase of SSL certificate for ${domain} of type ${type}.`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { success: true };
}

/**
 * Sets domain forwarding.
 * This is a placeholder.
 */
export async function setDomainForwarding(domain: string, destination: string) {
    console.log(`[Domain Action] Simulating setting forwarding for ${domain} to ${destination}.`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true };
}

/**
 * Sends a registrant consent email.
 * This is a placeholder.
 */
export async function sendRegistrantConsentEmail(domain: string) {
    console.log(`[Domain Action] Simulating sending of consent email for ${domain}.`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true };
}

/**
 * Manages DNSSEC settings for a domain.
 * This is a placeholder.
 */
export async function manageDnssec(domain: string, settings: any) {
    console.log(`[Domain Action] Simulating update of DNSSEC settings for ${domain}:`, settings);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true };
}
