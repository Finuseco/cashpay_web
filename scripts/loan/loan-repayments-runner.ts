import { processLoanRepayments } from '../../src/lib/actions/loan.actions';

async function main() {
  console.log(`[LoanMe] Début remboursement automatique — ${new Date().toISOString()}`);

  try {
    const result = await processLoanRepayments();

    console.log('[LoanMe] Résultat :');
    console.log(JSON.stringify(result, null, 2));

    process.exitCode = result?.success === false ? 1 : 0;
  } catch (error) {
    console.error('[LoanMe] ERREUR :', error);
    process.exitCode = 1;
  }
}

main();
