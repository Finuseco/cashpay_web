"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const loan_actions_1 = require("../../src/lib/actions/loan.actions");
async function main() {
    console.log(`[LoanMe] Début remboursement automatique — ${new Date().toISOString()}`);
    try {
        const result = await (0, loan_actions_1.processLoanRepayments)();
        console.log('[LoanMe] Résultat :');
        console.log(JSON.stringify(result, null, 2));
        process.exitCode = result?.success === false ? 1 : 0;
    }
    catch (error) {
        console.error('[LoanMe] ERREUR :', error);
        process.exitCode = 1;
    }
}
main();
