
'use server';
/**
 * @fileOverview An AI flow for verifying user wallet IDs.
 * This file wraps the underlying database action to be used as a server action.
 *
 * - verifyUser - A function that handles the wallet ID verification.
 */

import { verifyUser as verifyUserAction } from '@/lib/actions/auth.actions';
import type { VerifyUserInput, VerifyUserOutput } from '@/lib/actions/types';

// Export the types so other modules can use it
export type { VerifyUserInput, VerifyUserOutput };

// Create and export an async wrapper function that calls the original action.
// This complies with the "use server" directive which only allows async function exports.
export async function verifyUser(input: VerifyUserInput): Promise<VerifyUserOutput> {
  return await verifyUserAction(input);
}
