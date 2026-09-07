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
