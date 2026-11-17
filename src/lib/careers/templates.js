/* Modèles d'e-mails professionnels (violet CashPay All). HTML « tables » compatible messageries. */
'use strict';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = s => esc(s).replace(/\n/g, '<br>');

function shell(title, bodyHtml, lang) {
    const fr = lang !== 'en';
    return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4eff9;font-family:Arial,Helvetica,sans-serif;color:#2a1b3d">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4eff9;padding:24px 12px"><tr><td align="center">' +
        '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">' +
        '<tr><td style="background:#190a28;padding:26px 30px"><div style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:.3px">CashPay <span style="color:#c9a2f0">All</span></div>' +
        '<div style="font-size:13px;color:#b9a3d1;margin-top:4px">' + (fr ? 'Service Financier Numérique Congolais' : 'Congolese Digital Financial Service') + '</div></td></tr>' +
        '<tr><td style="height:4px;background:#7a22d4;line-height:4px;font-size:0">&nbsp;</td></tr>' +
        '<tr><td style="padding:30px"><h1 style="margin:0 0 18px;font-size:21px;color:#190a28">' + esc(title) + '</h1>' + bodyHtml + '</td></tr>' +
        '<tr><td style="background:#faf7fd;padding:18px 30px;font-size:12px;color:#6b5a82;line-height:1.6">FINUSECO SARL — CashPay All<br>info@cashpay-all.com · +243 85 386 80 21 · www.cashpay-all.com</td></tr>' +
        '</table></td></tr></table></body></html>';
}
const table = rows => '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6dcf0;border-radius:10px;border-collapse:separate;font-size:14px">' +
    rows.map((r, i) => '<tr><td style="padding:10px 14px;background:#faf7fd;width:38%;color:#6b5a82;' + (i ? 'border-top:1px solid #e6dcf0' : '') + '"><b>' + esc(r[0]) + '</b></td><td style="padding:10px 14px;' + (i ? 'border-top:1px solid #e6dcf0' : '') + '">' + esc(r[1]) + '</td></tr>').join('') + '</table>';

/** E-mail interne reçu par l'équipe (info@cashpay-all.com). */
function internal(d, ctx) {
    const rows = [['Référence', ctx.ref], ['Poste', ctx.position], ['Pays', ctx.country], ['Province / région', d.province], ['Nom', d.lastName], ['Prénom', d.firstName], ['Sexe', d.gender === 'F' ? 'Femme' : 'Homme'], ['Âge', d.age + ' ans'], ['Profession', d.profession], ['Téléphone', d.phone], ['E-mail', d.email], ['Ville / commune', d.city || '—'], ['Langue du candidat', d.lang === 'en' ? 'English' : 'Français']];
    const text = 'NOUVELLE CANDIDATURE — ' + ctx.position + '\n\n' + rows.map(r => r[0] + ' : ' + r[1]).join('\n') + '\n\nMessage du candidat :\n' + (d.message || '—') + '\n\nPièces jointes : ' + ctx.files.join(', ') + '\n\n(Répondre à ce message écrit directement au candidat.)';
    const html = shell('Nouvelle candidature — ' + ctx.position,
        '<p style="margin:0 0 16px;text-align:center"><img src="cid:photo@cashpay" alt="Photo" width="110" height="110" style="width:110px;height:110px;border-radius:55px;object-fit:cover;border:3px solid #7a22d4"></p><p style="margin:0 0 16px;font-size:14px;line-height:1.6">Une candidature vient d\'être déposée sur le site. Pour répondre au candidat, utilisez simplement « Répondre ».</p>' + table(rows) +
        '<h3 style="margin:22px 0 8px;font-size:15px;color:#190a28">Message du candidat</h3><div style="background:#faf7fd;border-left:4px solid #7a22d4;padding:12px 14px;font-size:14px;line-height:1.6">' + (d.message ? nl2br(d.message) : '—') + '</div>' +
        '<p style="margin:18px 0 0;font-size:13px;color:#6b5a82">Pièces jointes : ' + esc(ctx.files.join(', ')) + '</p>', 'fr');
    return { subject: '[Candidature] ' + ctx.position + ' — ' + d.lastName + ' ' + d.firstName + ' (' + d.province + ', ' + ctx.country + ') — ' + ctx.ref, text, html };
}

/** Accusé de réception automatique envoyé au candidat (noreply). */
function acknowledgement(d, ctx) {
    const en = d.lang === 'en';
    const T = en ? {
        subject: 'We received your application — ' + ctx.positionEn + ' (' + ctx.ref + ')', title: 'Your application has been received',
        hello: 'Hello ' + d.firstName + ',', p1: 'Thank you for your interest in CashPay All. We have received your application and our team will review it carefully.',
        recap: 'Summary of your application', next: 'What happens next', n1: 'Our team reviews your file.', n2: 'If your profile matches our needs, we will contact you by phone or e-mail.', n3: 'Keep this reference when contacting our recruitment team.',
        note: 'This is an automatic message, please do not reply to it. For any question, write to info@cashpay-all.com, quoting your reference.', sign: 'The CashPay All team',
        rows: [['Reference', ctx.ref], ['Position', ctx.positionEn], ['Location', d.province + ', ' + ctx.country], ['Name', d.firstName + ' ' + d.lastName]]
    } : {
        subject: 'Nous avons bien reçu votre candidature — ' + ctx.position + ' (' + ctx.ref + ')', title: 'Votre candidature a bien été reçue',
        hello: 'Bonjour ' + d.firstName + ',', p1: 'Merci de l\'intérêt que vous portez à CashPay All. Nous avons bien reçu votre candidature et notre équipe va l\'étudier avec attention.',
        recap: 'Récapitulatif de votre candidature', next: 'Et maintenant ?', n1: 'Notre équipe examine votre dossier.', n2: 'Si votre profil correspond à nos besoins, nous vous contacterons par téléphone ou par e-mail.', n3: 'Conservez cette référence pour vos échanges avec notre équipe de recrutement.',
        note: 'Ceci est un message automatique, merci de ne pas y répondre. Pour toute question, écrivez à info@cashpay-all.com en indiquant votre référence.', sign: 'L\'équipe CashPay All',
        rows: [['Référence', ctx.ref], ['Poste', ctx.position], ['Lieu', d.province + ', ' + ctx.country], ['Nom', d.firstName + ' ' + d.lastName]]
    };
    const html = shell(T.title,
        '<p style="margin:0 0 12px;font-size:15px">' + esc(T.hello) + '</p><p style="margin:0 0 20px;font-size:14px;line-height:1.7">' + esc(T.p1) + '</p>' +
        '<h3 style="margin:0 0 8px;font-size:15px;color:#190a28">' + esc(T.recap) + '</h3>' + table(T.rows) +
        '<h3 style="margin:22px 0 8px;font-size:15px;color:#190a28">' + esc(T.next) + '</h3><ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.8"><li>' + esc(T.n1) + '</li><li>' + esc(T.n2) + '</li><li>' + esc(T.n3) + '</li></ol>' +
        '<p style="margin:24px 0 4px;font-size:14px">' + esc(T.sign) + '</p>' +
        '<p style="margin:18px 0 0;padding-top:14px;border-top:1px solid #e6dcf0;font-size:12px;color:#6b5a82;line-height:1.6">' + esc(T.note) + '</p>', en ? 'en' : 'fr');
    const text = T.title + '\n\n' + T.hello + '\n\n' + T.p1 + '\n\n' + T.recap + ' :\n' + T.rows.map(r => '- ' + r[0] + ' : ' + r[1]).join('\n') + '\n\n' + T.next + ' :\n1. ' + T.n1 + '\n2. ' + T.n2 + '\n3. ' + T.n3 + '\n\n' + T.sign + '\n\n' + T.note;
    return { subject: T.subject, text, html };
}
module.exports = { internal, acknowledgement };
