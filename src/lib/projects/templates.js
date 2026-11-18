'use strict';
/* E-mails de soumission de projet (financement PME / startups). Même charte que les candidatures. */
const { shell, table, esc, nl2br } = require('../careers/templates');
const KINDS = {
    startup: { fr: 'Startup', en: 'Startup' }, fintech: { fr: 'Fintech', en: 'Fintech' }, pme: { fr: 'PME / entreprise existante', en: 'SME / existing business' },
    commerce: { fr: 'Commerce et livraison', en: 'Commerce and delivery' }, autre: { fr: 'Autre projet', en: 'Other project' }
};
const STAGES = {
    idee: { fr: 'Idée', en: 'Idea' }, prototype: { fr: 'Prototype', en: 'Prototype' }, produit: { fr: 'Produit lancé', en: 'Launched product' },
    croissance: { fr: 'Croissance', en: 'Growth' }
};
const label = (map, key, en) => (map[key] || map.autre || { fr: key, en: key })[en ? 'en' : 'fr'];

function internal(d, ctx) {
    const rows = [['Référence', ctx.ref], ['Projet', d.projectName], ['Type', label(KINDS, d.kind)], ['Étape', label(STAGES, d.stage)], ['Secteur', d.sector],
        ['Pays / ville', ctx.country + (d.city ? ' / ' + d.city : '')], ['Financement recherché', d.amount ? d.amount + ' USD' : 'Non précisé'],
        ['Contact', d.firstName + ' ' + d.lastName + (d.role ? ' (' + d.role + ')' : '')], ['Téléphone', d.phone], ['E-mail', d.email], ['Site / lien', d.website || '—'],
        ['Langue', d.lang === 'en' ? 'English' : 'Français'], ['Pièces jointes', ctx.files.length ? ctx.files.join(', ') : 'Aucune']];
    const html = shell('Nouveau projet à étudier', table(rows) +
        '<div style="margin:18px 0 6px;font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#7a22d4">Description du projet</div><div style="background:#faf7fd;border-left:4px solid #7a22d4;padding:12px 14px;font-size:14px;line-height:1.6">' + nl2br(d.description) + '</div>' +
        (d.useOfFunds ? '<div style="margin:18px 0 6px;font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#7a22d4">Utilisation du financement</div><div style="background:#faf7fd;border-left:4px solid #7a22d4;padding:12px 14px;font-size:14px;line-height:1.6">' + nl2br(d.useOfFunds) + '</div>' : ''), 'fr');
    const text = 'Nouveau projet ' + ctx.ref + '\n' + rows.map(r => r[0] + ' : ' + r[1]).join('\n') + '\n\nDescription :\n' + d.description + (d.useOfFunds ? '\n\nUtilisation du financement :\n' + d.useOfFunds : '');
    return { subject: 'Projet à financer — ' + d.projectName + ' (' + ctx.ref + ')', text, html };
}

function acknowledgement(d, ctx) {
    const en = d.lang === 'en';
    const T = en ? {
        subject: 'We received your project — ' + d.projectName + ' (' + ctx.ref + ')', title: 'Your project has been received', hello: 'Hello ' + d.firstName + ',',
        p1: 'Thank you for submitting your project to CashPay All. Our financing team will study it and come back to you.',
        nextT: 'What happens next', n: ['We review your project and its potential.', 'If it fits our financing criteria, we contact you for a meeting and the next steps.', 'Keep your reference for any exchange with us.'],
        recap: 'Your submission', note: 'This is an automatic message, please do not reply. For any question, write to info@cashpay-all.com quoting your reference.',
        sign: 'The CashPay All team', r: ['Reference', 'Project', 'Type', 'Stage', 'Financing sought']
    } : {
        subject: 'Nous avons bien reçu votre projet — ' + d.projectName + ' (' + ctx.ref + ')', title: 'Votre projet a bien été reçu', hello: 'Bonjour ' + d.firstName + ',',
        p1: 'Merci d\'avoir soumis votre projet à CashPay All. Notre équipe de financement va l\'étudier et reviendra vers vous.',
        nextT: 'Et maintenant ?', n: ['Nous étudions votre projet et son potentiel.', 'S\'il correspond à nos critères de financement, nous vous contactons pour un rendez-vous et les prochaines étapes.', 'Conservez votre référence pour tout échange avec nous.'],
        recap: 'Votre soumission', note: 'Ceci est un message automatique, merci de ne pas y répondre. Pour toute question, écrivez à info@cashpay-all.com en indiquant votre référence.',
        sign: 'L\'équipe CashPay All', r: ['Référence', 'Projet', 'Type', 'Étape', 'Financement recherché']
    };
    const rows = [[T.r[0], ctx.ref], [T.r[1], d.projectName], [T.r[2], label(KINDS, d.kind, en)], [T.r[3], label(STAGES, d.stage, en)], [T.r[4], d.amount ? d.amount + ' USD' : '—']];
    const html = shell(T.title, '<p style="margin:0 0 12px;font-size:15px">' + esc(T.hello) + '</p><p style="margin:0 0 18px;font-size:14px;line-height:1.7">' + esc(T.p1) + '</p>' +
        '<div style="margin:6px 0 8px;font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#7a22d4">' + esc(T.recap) + '</div>' + table(rows) +
        '<div style="margin:22px 0 8px;font-size:11px;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#7a22d4">' + esc(T.nextT) + '</div><ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.8"><li>' + esc(T.n[0]) + '</li><li>' + esc(T.n[1]) + '</li><li>' + esc(T.n[2]) + '</li></ol>' +
        '<p style="margin:24px 0 4px;font-size:14px">' + esc(T.sign) + '</p><p style="margin:18px 0 0;padding-top:14px;border-top:1px solid #e6dcf0;font-size:12px;color:#6b5a82;line-height:1.6">' + esc(T.note) + '</p>', en ? 'en' : 'fr');
    const text = T.title + '\n\n' + T.hello + '\n\n' + T.p1 + '\n\n' + rows.map(r => r[0] + ' : ' + r[1]).join('\n') + '\n\n' + T.nextT + ' :\n1. ' + T.n[0] + '\n2. ' + T.n[1] + '\n3. ' + T.n[2] + '\n\n' + T.sign + '\n\n' + T.note;
    return { subject: T.subject, text, html };
}
module.exports = { internal, acknowledgement, KINDS, STAGES };
