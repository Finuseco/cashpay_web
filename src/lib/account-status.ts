/** A blocked account cannot create or reuse a financial session. */
export function blockedAccountMessage(user: { status?: unknown; suspension_reason?: unknown }): string | null {
    if (!['suspended', 'blocked', 'banned', 'disabled', 'inactive', 'closed'].includes(String(user.status || '').trim().toLowerCase())) return null;
    const reason = typeof user.suspension_reason === 'string' ? user.suspension_reason.trim() : '';
    return reason ? `Accès bloqué : ${reason}` : 'Votre compte est suspendu. Contactez le support CashPay.';
}
