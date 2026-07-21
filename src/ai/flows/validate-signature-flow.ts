
'use server';
/**
 * @fileOverview An AI agent for validating user signature images.
 *
 * - validateSignature - A function that handles the signature image validation.
 */

import {ai} from '@/ai/genkit';
import { ValidateSignatureInputSchema, ValidateSignatureOutputSchema, type ValidateSignatureInput, type ValidateSignatureOutput } from './types';


export async function validateSignature(input: ValidateSignatureInput): Promise<ValidateSignatureOutput> {
  return validateSignatureFlow(input);
}

const prompt = ai.definePrompt({
  name: 'validateSignaturePrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: ValidateSignatureInputSchema},
  output: {schema: ValidateSignatureOutputSchema},
  prompt: `You are a document verification system. Analyze the provided image.

Your primary task is to determine if the image contains a handwritten signature.

Follow these rules:
1.  If a handwritten signature is present, 'isValid' MUST be true.
2.  The presence of other text, lines, or complex backgrounds does NOT invalidate the image, as long as a signature is clearly visible.
3.  The image should not be a photograph of a person, an object, or a drawing that is clearly not a signature.
4.  The signature should be reasonably clear and not excessively blurry.

Respond with 'isValid' as true if a signature is visible. If not, respond with 'isValid' as false and provide a brief, user-friendly reason in French.

Image to analyze: {{media url=signatureDataUri}}`,
});

const validateSignatureFlow = ai.defineFlow(
  {
    name: 'validateSignatureFlow',
    inputSchema: ValidateSignatureInputSchema,
    outputSchema: ValidateSignatureOutputSchema,
  },
  async (input: ValidateSignatureInput): Promise<ValidateSignatureOutput> => {
    const {output} = await prompt(input);
    return output!;
  }
);
