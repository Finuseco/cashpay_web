'use strict';

function createOtpDelivery({ sendEmail, sendSms, sendWhatsAppTextMessage, env = process.env }) {
  return async ({ user, channel, otp }) => {
    const message = `CashPay Main : votre code de connexion administrateur est ${otp}. Valable 10 minutes. Ne le partagez pas.`;
    if (channel === 'email' && user.email) {
      // The existing provider simulates success and logs the OTP when these are
      // missing. Refuse before invoking it, including in development.
      if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) return false;
      const result = await sendEmail(user.email, 'Votre code de connexion CashPay Main', 'otp', {
        title: 'Connexion administrateur CashPay Main', greeting: 'Bonjour,',
        intro: 'Voici votre code de vérification pour le site principal CashPay :',
        otpCode: otp, warning: 'Ce code expire dans 10 minutes. Ne le partagez avec personne.',
        signature: 'L’équipe de sécurité CashPay',
      });
      return result?.success === true;
    }
    if (channel === 'sms' && user.phone) {
      if (!env.DREAM_DIGITAL_API_URL || !env.DREAM_DIGITAL_API_ID || !env.DREAM_DIGITAL_API_PASSWORD || env.DREAM_DIGITAL_API_ID.includes('YOUR_API_ID')) return false;
      return (await sendSms(user.phone, message))?.success === true;
    }
    if (channel === 'whatsapp' && user.phone) {
      if (!env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_ACCESS_TOKEN) return false;
      return (await sendWhatsAppTextMessage(user.phone, message))?.success === true;
    }
    return false;
  };
}

module.exports = { createOtpDelivery };
