/* Modèles d'e-mails professionnels (violet CashPay All). HTML « tables » compatible messageries. */
'use strict';
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nl2br = s => esc(s).replace(/\n/g, '<br>');

function shell(title, bodyHtml, lang) {
    const fr = lang !== 'en';
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>' +
        '<body style="margin:0;padding:0;background:#f4eff9;font-family:Arial,Helvetica,sans-serif;color:#2a1b3d">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4eff9;padding:24px 12px"><tr><td align="center">' +
        '<table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(60,20,100,.12)">' +
        // En-tête : « CashPay » à gauche, logo CP violet de l'autre côté
        '<tr><td style="background:#190a28;background-image:linear-gradient(135deg,#190a28 0%,#2c1048 100%);padding:26px 30px">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td align="left" valign="middle"><img src="cid:logo@cashpay" alt="CashPay All" width="150" style="display:block;width:150px;height:auto;border:0"></td>' +
        '<td align="right" valign="middle"><img src="cid:cp@cashpay" alt="CP" width="62" style="display:block;width:62px;height:auto;border:0;margin-left:auto"></td>' +
        '</tr></table>' +
        '<div style="font-size:12px;letter-spacing:.6px;text-transform:uppercase;color:#b9a3d1;margin-top:14px">' + (fr ? 'Service Financier Numérique Congolais' : 'Congolese Digital Financial Service') + '</div></td></tr>' +
        '<tr><td style="height:4px;background:#7a22d4;background-image:linear-gradient(90deg,#c9a2f0,#7a22d4);line-height:4px;font-size:0">&nbsp;</td></tr>' +
        '<tr><td style="padding:32px 30px 30px"><h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#190a28">' + esc(title) + '</h1>' + bodyHtml + '</td></tr>' +
        '<tr><td style="background:#190a28;padding:20px 30px;font-size:12px;color:#b9a3d1;line-height:1.7"><b style="color:#ffffff">FINUSECO SARL — CashPay All</b><br>info@cashpay-all.com · +243 85 386 80 21 · www.cashpay-all.com</td></tr>' +
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
    const sex = d.gender === 'F' ? (en ? 'Woman' : 'Femme') : (en ? 'Man' : 'Homme');
    const docs = (ctx.files || []).map(f => String(f).replace(/^(Photo|CV|Doc\d)_/, m => ({ 'Photo_': (en ? 'Photo: ' : 'Photo : '), 'CV_': (en ? 'CV: ' : 'CV : ') }[m] || (en ? 'Document: ' : 'Document : '))));
    const T = en ? {
        subject: 'We received your application — ' + ctx.positionEn + ' (' + ctx.ref + ')', title: 'Your application has been received',
        hello: 'Hello ' + d.firstName + ',', p1: 'Thank you for your interest in CashPay All. We have received your application and our team will review it carefully.',
        introTitle: 'How we work',
        intro: ['Applications are open to candidates from <b>any country</b>: wherever you live, you are welcome to apply.',
            'We recruit people to work <b>remotely, online</b>. This is not a traditional contract nor exactly freelance work: it is remote work that requires a solid command of <b>IT, the internet and finance</b>. We are looking above all for <b>finance profiles</b>.',
            'Selected candidates will have an account opened and will start working remotely as our <b>local representatives</b>. Later, as the project grows, we may set up a foundation or a local office. <b>For now, everything is done online.</b>',
            'All remuneration is <b>paid within the CashPay network</b>.'],
        cv: 'Your application', profile: 'Profile', contact: 'Contact', applied: 'Position applied for', msg: 'Your message', docsT: 'Documents sent', refT: 'Reference',
        lbl: { sex: 'Gender', age: 'Age', loc: 'Location', city: 'City / district', phone: 'Phone', email: 'E-mail', yrs: ' years old' },
        next: 'What happens next', n: ['Our team reviews your file.', 'If your profile matches our needs, we will contact you by phone or e-mail.', 'Keep this reference when contacting our recruitment team.'],
        note: 'This is an automatic message, please do not reply to it. For any question, write to info@cashpay-all.com, quoting your reference.', sign: 'The CashPay All team', pos: ctx.positionEn
    } : {
        subject: 'Nous avons bien reçu votre candidature — ' + ctx.position + ' (' + ctx.ref + ')', title: 'Votre candidature a bien été reçue',
        hello: 'Bonjour ' + d.firstName + ',', p1: 'Merci de l\'intérêt que vous portez à CashPay All. Nous avons bien reçu votre candidature et notre équipe va l\'étudier avec attention.',
        introTitle: 'Notre façon de travailler',
        intro: ['Les candidatures sont ouvertes aux personnes de <b>n\'importe quel pays</b> : où que vous viviez, vous pouvez postuler.',
            'Nous recrutons pour un travail <b>à distance, en ligne</b>. Ce n\'est pas un contrat classique ni vraiment du freelance : il s\'agit d\'un travail à distance qui demande une bonne maîtrise de <b>l\'informatique, d\'internet et de la finance</b>. Nous recherchons surtout des <b>profils en finance</b>.',
            'Les personnes retenues se verront ouvrir un compte et commenceront à travailler à distance comme <b>représentants locaux</b>. Plus tard, nous pourrons organiser une fondation ou un bureau local. <b>Pour le moment, tout se fait en ligne.</b>',
            'Toute la rémunération est <b>versée au sein du réseau CashPay</b>.'],
        cv: 'Votre candidature', profile: 'Profil', contact: 'Contact', applied: 'Poste visé', msg: 'Votre message', docsT: 'Documents transmis', refT: 'Référence',
        lbl: { sex: 'Sexe', age: 'Âge', loc: 'Lieu', city: 'Ville / commune', phone: 'Téléphone', email: 'E-mail', yrs: ' ans' },
        next: 'Et maintenant ?', n: ['Notre équipe examine votre dossier.', 'Si votre profil correspond à nos besoins, nous vous contacterons par téléphone ou par e-mail.', 'Conservez cette référence pour vos échanges avec notre équipe de recrutement.'],
        note: 'Ceci est un message automatique, merci de ne pas y répondre. Pour toute question, écrivez à info@cashpay-all.com en indiquant votre référence.', sign: 'L\'équipe CashPay All', pos: ctx.position
    };
    const h = t => '<div style="margin:22px 0 8px;font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#7a22d4">' + esc(t) + '</div>';
    const line = (k, v) => '<tr><td style="padding:7px 0;width:34%;font-size:13px;color:#6b5a82;vertical-align:top">' + esc(k) + '</td><td style="padding:7px 0;font-size:14px;color:#190a28;vertical-align:top"><b>' + esc(v) + '</b></td></tr>';
    const lines = rows => '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + rows.map(r => line(r[0], r[1])).join('') + '</table>';
    const full = (d.firstName + ' ' + d.lastName).trim();
    const profile = [[T.lbl.sex, sex], [T.lbl.age, d.age + T.lbl.yrs], [T.lbl.loc, d.province + ', ' + ctx.country]];
    if (d.city) profile.push([T.lbl.city, d.city]);
    const card =
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6dcf0;border-radius:14px;border-collapse:separate;overflow:hidden">' +
        '<tr><td style="background:#7a22d4;background-image:linear-gradient(135deg,#9a4be8,#6a17c0);padding:24px 22px" align="center">' +
        '<img src="cid:photo@cashpay" alt="" width="104" height="104" style="display:block;width:104px;height:104px;border-radius:52px;object-fit:cover;border:4px solid #ffffff;margin:0 auto">' +
        '<div style="margin-top:14px;font-size:22px;font-weight:bold;color:#ffffff;line-height:1.25">' + esc(full) + '</div>' +
        '<div style="margin-top:4px;font-size:14px;color:#eadcfa">' + esc(d.profession) + '</div>' +
        '<div style="margin-top:12px"><span style="display:inline-block;background:#190a28;color:#ffffff;font-size:12px;padding:6px 14px;border-radius:14px">' + esc(T.pos) + '</span></div></td></tr>' +
        '<tr><td style="padding:6px 22px 20px">' +
        h(T.profile) + lines(profile) +
        h(T.contact) + lines([[T.lbl.phone, d.phone], [T.lbl.email, d.email]]) +
        (d.message ? h(T.msg) + '<div style="background:#faf7fd;border-left:4px solid #7a22d4;padding:12px 14px;font-size:14px;line-height:1.6;color:#2a1b3d">' + nl2br(d.message) + '</div>' : '') +
        (docs.length ? h(T.docsT) + '<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8;color:#2a1b3d">' + docs.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') +
        '</td></tr>' +
        '<tr><td style="background:#faf7fd;border-top:1px solid #e6dcf0;padding:12px 22px;font-size:12px;color:#6b5a82">' + esc(T.refT) + ' : <b style="color:#190a28;letter-spacing:.4px">' + esc(ctx.ref) + '</b></td></tr></table>';
    const html = shell(T.title,
        '<p style="margin:0 0 12px;font-size:15px">' + esc(T.hello) + '</p><p style="margin:0 0 20px;font-size:14px;line-height:1.7">' + esc(T.p1) + '</p>' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7fd;border-radius:12px;border-left:4px solid #7a22d4"><tr><td style="padding:16px 18px">' +
        '<div style="font-size:15px;font-weight:bold;color:#190a28;margin-bottom:8px">' + esc(T.introTitle) + '</div>' +
        T.intro.map(t => '<p style="margin:0 0 9px;font-size:14px;line-height:1.7;color:#2a1b3d">' + t + '</p>').join('') + '</td></tr></table>' +
        h(T.cv) + card +
        h(T.next) + '<ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.8"><li>' + esc(T.n[0]) + '</li><li>' + esc(T.n[1]) + '</li><li>' + esc(T.n[2]) + '</li></ol>' +
        '<p style="margin:24px 0 4px;font-size:14px">' + esc(T.sign) + '</p>' +
        '<p style="margin:18px 0 0;padding-top:14px;border-top:1px solid #e6dcf0;font-size:12px;color:#6b5a82;line-height:1.6">' + esc(T.note) + '</p>', en ? 'en' : 'fr');
    const strip = t => t.replace(/<[^>]+>/g, '');
    const text = T.title + '\n\n' + T.hello + '\n\n' + T.p1 + '\n\n' + T.introTitle + ' :\n' + T.intro.map(t => '- ' + strip(t)).join('\n') +
        '\n\n' + T.cv + ' :\n' + full + ' — ' + d.profession + '\n' + T.applied + ' : ' + T.pos + '\n' + profile.map(r => r[0] + ' : ' + r[1]).join('\n') +
        '\n' + T.lbl.phone + ' : ' + d.phone + '\n' + T.lbl.email + ' : ' + d.email + (d.message ? '\n' + T.msg + ' : ' + d.message : '') +
        (docs.length ? '\n' + T.docsT + ' : ' + docs.join(', ') : '') + '\n' + T.refT + ' : ' + ctx.ref +
        '\n\n' + T.next + ' :\n1. ' + T.n[0] + '\n2. ' + T.n[1] + '\n3. ' + T.n[2] + '\n\n' + T.sign + '\n\n' + T.note;
    return { subject: T.subject, text, html };
}
module.exports = { internal, acknowledgement, shell, table, esc, nl2br };
