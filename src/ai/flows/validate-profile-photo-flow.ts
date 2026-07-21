
'use server';
/**
 * @fileOverview An AI agent for validating user profile photos.
 *
 * - validateProfilePhoto - A function that handles the profile photo validation.
 */

import {ai} from '@/ai/genkit';
import { ValidateProfilePhotoInputSchema, ValidateProfilePhotoOutputSchema, type ValidateProfilePhotoInput, type ValidateProfilePhotoOutput } from './types';


export async function validateProfilePhoto(input: ValidateProfilePhotoInput): Promise<ValidateProfilePhotoOutput> {
  return validateProfilePhotoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'validateProfilePhotoPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: ValidateProfilePhotoInputSchema},
  output: {schema: ValidateProfilePhotoOutputSchema},
  prompt: `You are a strict KYC (Know Your Customer) verification system. Analyze the provided image for its suitability as a user profile photo for a financial application.

Follow these rules strictly. If any rule is violated, set 'isValid' to false and provide a clear reason in French. Your output MUST be in valid JSON format.
1.  The image must contain a human face, clearly visible and forward-facing.
2.  There must be only ONE person in the image.
3.  The person must NOT be wearing glasses (sunglasses or prescription glasses).
4.  The person must NOT be wearing a hat, cap, or any head covering that obscures the hair or forehead (religious head coverings are acceptable if the face is fully visible).
5.  The image must NOT be an object, animal, cartoon, drawing, landscape, or group photo.
6.  The image must be of reasonable quality, not excessively blurry or dark.

Respond with 'isValid' as true ONLY if it meets all criteria. Otherwise, respond with 'isValid' as false and a concise reason.

Image to analyze: {{media url=photoDataUri}}`,
});

const validateProfilePhotoFlow = ai.defineFlow(
  {
    name: 'validateProfilePhotoFlow',
    inputSchema: ValidateProfilePhotoInputSchema,
    outputSchema: ValidateProfilePhotoOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
