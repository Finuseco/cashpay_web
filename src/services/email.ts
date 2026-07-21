
'use server';

import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';

interface EmailResponse {
  success: boolean;
  message: string;
}

const templatePaths = {
  otp: 'otp.html',
  receipt: 'receipt.html',
  general: 'general.html',
  alert: 'alert.html',
  welcome: 'welcome.html',
  new_message: 'new_message.html',
  ticket: 'ticket.html',
  'product_boost_2-cols': 'product-boost-2-cols.html',
  'product_boost_3-cols': 'product-boost-3-cols.html',
  'product_boost_featured': 'product-boost-featured.html',
  verify_site: 'verify-site.html',
  site_approved: 'site-approved.html',
  site_rejected_competitors: 'site-rejected-competitors.html',
  site_verification_failed: 'site-verification-failed.html',
  new_login_alert: 'new_login_alert.html',
  mlm_welcome: 'mlm_welcome.html',
  mlm_commission: 'mlm_commission.html',
  mlm_rank_up: 'mlm_rank_up.html',
  loanme_member_added: 'loanme_member_added.html',
  b2b_welcome: 'b2b_welcome.html',
};

/**
 * Sends an email using a direct SMTP transport as configured in the environment variables.
 * It can now render HTML templates with dynamic data.
 * 
 * @param to The recipient's email address.
 * @param subject The email subject.
 * @param template The name of the HTML template to use (e.g., 'otp', 'welcome').
 * @param data The data to inject into the template's placeholders.
 * @returns A promise that resolves with the email response.
 */
export async function sendEmail(
    to: string, 
    subject: string, 
    template: keyof typeof templatePaths,
    data: Record<string, any>
): Promise<EmailResponse> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASSWORD;

  if (!smtpHost || !smtpUser || !smtpPass) {
    const errorMessage = 'SMTP configuration is incomplete. Email will be logged to console instead of being sent.';
    console.warn(`[Email Service] ${errorMessage}`);
    console.log(`--- MOCK EMAIL to ${to} ---`);
    console.log(`Subject: ${subject}`);
    console.log(`Template: ${template}`);
    console.log(`Data:`, data);
    console.log(`--- END MOCK EMAIL ---`);
    return { success: true, message: 'Email service not configured, logged to console.' };
  }
  
  try {
    // 1. Read base template and specific template
    const templateFileName = templatePaths[template];
    if (!templateFileName) {
        throw new Error(`Template '${template}' not found in templatePaths.`);
    }

    const baseTemplatePath = path.join(process.cwd(), 'src', 'lib', 'email-templates', '_base.html');
    const specificTemplatePath = path.join(process.cwd(), 'src', 'lib', 'email-templates', templateFileName);

    let baseTemplate = await fs.readFile(baseTemplatePath, 'utf-8');
    let specificContent = await fs.readFile(specificTemplatePath, 'utf-8');

    // 2. Inject specific content into the base template's body
    baseTemplate = baseTemplate.replace('{{{body}}}', specificContent);

    // 3. Inject data into the final template using a simple regex replace for Handlebars-like syntax
    let finalHtml = baseTemplate;
    for (const key in data) {
        // Ensure data[key] is treated as a string and handle undefined values gracefully
        const value = data[key] !== undefined && data[key] !== null ? String(data[key]) : '';
        // This regex handles {{variable}} and {{{variable}}} syntax
        finalHtml = finalHtml.replace(new RegExp(`{{{?${key}}}}?`, 'g'), value);
    }
    // Inject the current year and subject
    finalHtml = finalHtml.replace(new RegExp('{{year}}', 'g'), new Date().getFullYear().toString());
    finalHtml = finalHtml.replace(new RegExp('{{subject}}', 'g'), subject);


    // Create a Nodemailer transporter instance
    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // `true` for port 465 (SSL), `false` for others (TLS)
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production' 
        }
    });

    const mailOptions = {
        from: `"CashPay All" <${smtpUser}>`,
        to: to,
        subject: subject,
        html: finalHtml,
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email Service] Email sent to ${to}. Message ID: ${info.id || info.messageId}`);
    return { success: true, message: 'Email sent successfully.' };

  } catch (error: any) {
    console.error('[Email Service] Critical error:', error);
    return { success: false, message: `An unexpected error occurred: ${error.message}` };
  }
}
