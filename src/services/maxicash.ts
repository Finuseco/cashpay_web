/**
 * Initie un paiement Mobile Money via MaxiCash.
 *
 * IMPORTANT :
 * Cette fonction ne crédite JAMAIS le wallet.
 *
 * Une réponse positive de MaxiCash signifie uniquement que
 * la demande a été acceptée/initiée.
 *
 * Le crédit du wallet doit exclusivement être effectué après
 * confirmation finale de MaxiCash par webhook ou vérification
 * de statut.
 */
export async function processMaxiCashMobilePayment(args: {
    amount: number;
    currency: string;
    phoneNumber: string;
    operator: string;
    reference: string;
    countryCode: string;
    user?: User;
}): Promise<{
    success: boolean;
    pending?: boolean;
    data?: {
        transactionId?: string;
        statusCode?: string;
        statusMessage?: string;
    };
    message?: string;
}> {
    if (!MERCHANT_ID || !MERCHANT_PASSWORD) {
        return {
            success: false,
            pending: false,
            message: "Service MaxiCash indisponible.",
        };
    }

    const {
        amount,
        currency,
        reference,
        phoneNumber,
        operator,
        countryCode,
        user,
    } = args;

    if (!Number.isFinite(amount) || amount <= 0) {
        return {
            success: false,
            pending: false,
            message: "Montant invalide.",
        };
    }

    const amountStr = amount.toFixed(2);
    const provider = mapProvider(operator, countryCode);

    try {
        const payVerifyHash = await getPaymentHash({
            reference,
            amount: amountStr,
        });

        const soapRequestBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">

  <soap:Body>
    <PayIn xmlns="http://www.maxicashme.com/Api">

      <PayType>mobile</PayType>

      <MerchantID>${MERCHANT_ID}</MerchantID>

      <MerchantPassword>${MERCHANT_PASSWORD}</MerchantPassword>

      <Amount>${amountStr}</Amount>

      <Currency>${currency}</Currency>

      <Ref>${reference}</Ref>

      <PayVerifyHash>${payVerifyHash}</PayVerifyHash>

      <ClientName>${user?.full_name || "Client CashPay"}</ClientName>

      <ClientEmail>${user?.email || "noreply@cashpay-all.com"}</ClientEmail>

      <ClientTelephone>${user?.phone || phoneNumber}</ClientTelephone>

      <PhoneNumber>${phoneNumber}</PhoneNumber>

      <Provider>${provider}</Provider>

    </PayIn>
  </soap:Body>
</soap:Envelope>`;

        console.log(
            `[MaxiCash] Initiating deposit ${reference}: ` +
            `${amountStr} ${currency} / ${phoneNumber} / ${provider}`
        );

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "text/xml; charset=utf-8",
                "SOAPAction":
                    '"http://www.maxicashme.com/Api/PayIn"',
            },
            body: soapRequestBody,
        });

        const responseText = await response.text();

        console.log(
            `[MaxiCash] Raw response for ${reference}:`,
            responseText
        );

        const statusCode =
            responseText.match(
                /<StatusCode>(.*?)<\/StatusCode>/
            )?.[1] || "";

        const statusMessage =
            responseText.match(
                /<StatusMessage>(.*?)<\/StatusMessage>/
            )?.[1] || "";

        const transactionId =
            responseText.match(
                /<TransactionID>(.*?)<\/TransactionID>/
            )?.[1] || "";

        /*
         * MaxiCash a accepté la demande.
         *
         * ATTENTION :
         * "000" ici ne signifie PAS que CashPay doit créditer
         * le wallet.
         *
         * Il signifie que la demande est acceptée/initiée.
         */
        if (statusCode === "000") {
            console.log(
                `[MaxiCash] Deposit ${reference} accepted and pending confirmation. ` +
                `MaxiCash TransactionID=${transactionId}`
            );

            return {
                success: true,
                pending: true,
                message:
                    "Demande de dépôt envoyée. " +
                    "Veuillez confirmer le paiement sur votre téléphone.",
                data: {
                    transactionId: transactionId || undefined,
                    statusCode,
                    statusMessage,
                },
            };
        }

        /*
         * La demande n'a pas été acceptée par MaxiCash.
         *
         * Dans ce cas, CashPay pourra passer la transaction
         * Pending -> Failed.
         */
        console.warn(
            `[MaxiCash] Deposit ${reference} rejected. ` +
            `StatusCode=${statusCode}, Status=${statusMessage}`
        );

        return {
            success: false,
            pending: false,
            message:
                statusMessage ||
                "MaxiCash n'a pas accepté la demande de dépôt.",
            data: {
                transactionId: transactionId || undefined,
                statusCode,
                statusMessage,
            },
        };

    } catch (error) {
        console.error(
            `[MaxiCash] Communication error for ${reference}:`,
            error
        );

        /*
         * Une erreur réseau ne signifie PAS que le dépôt est
         * réussi.
         *
         * On ne crédite donc absolument rien.
         */
        return {
            success: false,
            pending: true,
            message:
                "Votre demande est en cours de vérification. " +
                "Veuillez patienter avant de refaire un dépôt.",
        };
    }
}

/**
 * Génère une session de paiement MaxiCash PayEntryWeb pour un dépôt carte.
 *
 * IMPORTANT :
 * - CashPay ne reçoit jamais les données de carte.
 * - MaxiCash héberge la saisie sécurisée.
 * - La transaction CashPay reste Pending jusqu'au webhook.
 */
export async function processMaxiCashCardPayment(args: {
    amount: number;
    currency: string;
    reference: string;
    user?: User;
}): Promise<{
    success: boolean;
    pending?: boolean;
    data?: {
        logId?: string;
        paymentUrl?: string;
    };
    message?: string;
}> {
    if (!MERCHANT_ID || !MERCHANT_PASSWORD) {
        return {
            success: false,
            pending: false,
            message: "Service MaxiCash indisponible.",
        };
    }

    const { amount, currency, reference, user } = args;

    if (!Number.isFinite(amount) || amount <= 0) {
        return {
            success: false,
            pending: false,
            message: "Montant invalide.",
        };
    }

    try {
        const amountInCents = Math.round(amount * 100);

        const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.APP_URL ||
            "https://app.cashpay-all.com";

        const notifyUrl =
            process.env.MAXICASH_NOTIFY_URL ||
            `${baseUrl}/api/webhooks/maxicash`;

        const successUrl =
            process.env.MAXICASH_SUCCESS_URL ||
            `${baseUrl}/deposit/success?reference=${encodeURIComponent(reference)}`;

        const failureUrl =
            process.env.MAXICASH_FAILURE_URL ||
            `${baseUrl}/deposit/failure?reference=${encodeURIComponent(reference)}`;

        const cancelUrl =
            process.env.MAXICASH_CANCEL_URL ||
            `${baseUrl}/deposit/cancel?reference=${encodeURIComponent(reference)}`;

        const form = new URLSearchParams();

        form.set("PayType", "card");
        form.set("MerchantID", MERCHANT_ID);
        form.set("MerchantPassword", MERCHANT_PASSWORD);
        form.set("Amount", String(amountInCents));
        form.set("Currency", currency);
        form.set("Language", "fr");
        form.set("Reference", reference);
        form.set("ClientName", user?.full_name || "Client CashPay");
        form.set(
            "ClientEmail",
            user?.email || "noreply@cashpay-all.com"
        );
        form.set("ClientTelephone", user?.phone || "");
        form.set("SuccessURL", successUrl);
        form.set("FailureURL", failureUrl);
        form.set("CancelURL", cancelUrl);
        form.set("NotifyURL", notifyUrl);

        const response = await fetch(
            "https://webapi.maxicashapp.com/Integration/PayEntryWeb",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",
                },
                body: form.toString(),
            }
        );

        const responseText = await response.text();

        console.log(
            `[MaxiCash] PayEntryWeb response for ${reference}:`,
            responseText
        );

        if (!response.ok) {
            return {
                success: false,
                pending: false,
                message:
                    "MaxiCash n'a pas pu créer la session de paiement.",
            };
        }

        const logId =
            responseText.match(
                /<LogID>(.*?)<\/LogID>/i
            )?.[1]?.trim() ||
            responseText.match(
                /<LogId>(.*?)<\/LogId>/i
            )?.[1]?.trim() ||
            responseText.match(
                /LogID[=:>"'\s]+([A-Za-z0-9_-]+)/i
            )?.[1]?.trim();

        if (!logId) {
            console.error(
                `[MaxiCash] Aucun LogID retourné pour ${reference}.`
            );

            return {
                success: false,
                pending: false,
                message:
                    "MaxiCash n'a pas retourné de session de paiement.",
            };
        }

        const paymentUrl =
            `https://api.maxicashapp.com/payentryweb?logid=${encodeURIComponent(logId)}`;

        return {
            success: true,
            pending: true,
            data: {
                logId,
                paymentUrl,
            },
            message:
                "Session de paiement MaxiCash créée.",
        };
    } catch (error) {
        console.error(
            `[MaxiCash] PayEntryWeb error for ${reference}:`,
            error
        );

        return {
            success: false,
            pending: false,
            message:
                "Impossible de créer la session de paiement MaxiCash.",
        };
    }
}

/**
 * Génère une session MaxiCash pour un dépôt PayPal.
 *
 * CashPay ne traite jamais les identifiants PayPal.
 * L'utilisateur effectue le paiement directement dans
 * la passerelle sécurisée MaxiCash.
 */
export async function processMaxiCashPaypalPayment(args: {
    amount: number;
    currency: string;
    reference: string;
    user?: User;
}): Promise<{
    success: boolean;
    pending?: boolean;
    data?: {
        logId?: string;
        paymentUrl?: string;
    };
    message?: string;
}> {
    if (!MERCHANT_ID || !MERCHANT_PASSWORD) {
        return {
            success: false,
            pending: false,
            message: "Service MaxiCash indisponible.",
        };
    }

    const { amount, currency, reference, user } = args;

    if (!Number.isFinite(amount) || amount <= 0) {
        return {
            success: false,
            pending: false,
            message: "Montant invalide.",
        };
    }

    try {
        const amountInCents = Math.round(amount * 100);

        const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.APP_URL ||
            "https://app.cashpay-all.com";

        const notifyUrl =
            process.env.MAXICASH_NOTIFY_URL ||
            `${baseUrl}/api/webhooks/maxicash`;

        const successUrl =
            process.env.MAXICASH_SUCCESS_URL ||
            `${baseUrl}/deposit/success?reference=${encodeURIComponent(reference)}`;

        const failureUrl =
            process.env.MAXICASH_FAILURE_URL ||
            `${baseUrl}/deposit/failure?reference=${encodeURIComponent(reference)}`;

        const cancelUrl =
            process.env.MAXICASH_CANCEL_URL ||
            `${baseUrl}/deposit/cancel?reference=${encodeURIComponent(reference)}`;

        const form = new URLSearchParams();

        form.set("PayType", "paypal");
        form.set("MerchantID", MERCHANT_ID);
        form.set("MerchantPassword", MERCHANT_PASSWORD);
        form.set("Amount", String(amountInCents));
        form.set("Currency", currency);
        form.set("Language", "fr");
        form.set("Reference", reference);
        form.set("ClientName", user?.full_name || "Client CashPay");
        form.set(
            "ClientEmail",
            user?.email || "noreply@cashpay-all.com"
        );
        form.set("ClientTelephone", user?.phone || "");
        form.set("SuccessURL", successUrl);
        form.set("FailureURL", failureUrl);
        form.set("CancelURL", cancelUrl);
        form.set("NotifyURL", notifyUrl);

        const response = await fetch(
            "https://webapi.maxicashapp.com/Integration/PayEntryWeb",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/x-www-form-urlencoded",
                },
                body: form.toString(),
            }
        );

        const responseText = await response.text();

        console.log(
            `[MaxiCash] PayPal PayEntryWeb response for ${reference}:`,
            responseText
        );

        if (!response.ok) {
            return {
                success: false,
                pending: false,
                message:
                    "MaxiCash n'a pas pu créer la session PayPal.",
            };
        }

        const logId =
            responseText.match(
                /<LogID>(.*?)<\/LogID>/i
            )?.[1]?.trim() ||
            responseText.match(
                /<LogId>(.*?)<\/LogId>/i
            )?.[1]?.trim() ||
            responseText.match(
                /LogID[=:>"'\s]+([A-Za-z0-9_-]+)/i
            )?.[1]?.trim();

        if (!logId) {
            console.error(
                `[MaxiCash] Aucun LogID PayPal pour ${reference}.`
            );

            return {
                success: false,
                pending: false,
                message:
                    "MaxiCash n'a pas retourné de session PayPal.",
            };
        }

        const paymentUrl =
            `https://api.maxicashapp.com/payentryweb?logid=${encodeURIComponent(logId)}`;

        return {
            success: true,
            pending: true,
            data: {
                logId,
                paymentUrl,
            },
            message:
                "Session PayPal MaxiCash créée.",
        };
    } catch (error) {
        console.error(
            `[MaxiCash] PayPal PayEntryWeb error for ${reference}:`,
            error
        );

        return {
            success: false,
            pending: false,
            message:
                "Impossible de créer la session PayPal MaxiCash.",
        };
    }
}

