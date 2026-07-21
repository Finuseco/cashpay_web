
'use server';
/**
 * @fileOverview An AI agent for extracting information from identity documents.
 *
 * - extractIdInfo - A function that handles the ID information extraction.
 */

import {ai} from '@/ai/genkit';
import { ExtractIdInfoInputSchema, ExtractIdInfoOutputSchema, type ExtractIdInfoInput, type ExtractIdInfoOutput } from './types';


export async function extractIdInfo(input: ExtractIdInfoInput): Promise<ExtractIdInfoOutput> {
  return extractIdInfoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractIdInfoPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: ExtractIdInfoInputSchema},
  output: {schema: ExtractIdInfoOutputSchema},
  prompt: `You are an expert document analysis system. Your task is to analyze the provided image of an identity document.

First, determine if the image is a valid identity document. If it is not a real ID (e.g., a photo of an object, a blurry image, an unrelated picture), set 'isDocumentValid' to false.

If it is a valid document, extract the following information precisely as it appears on the document:
1.  **Full Name**: The complete name of the individual.
2.  **ID Number**: The main identification number (e.g., "Numéro de la carte", "Passport No.").

If the document is valid, set 'isDocumentValid' to true.

Image to analyze: {{media url=idCardDataUri}}`,
});

const extractIdInfoFlow = ai.defineFlow(
  {
    name: 'extractIdInfoFlow',
    inputSchema: ExtractIdInfoInputSchema,
    outputSchema: ExtractIdInfoOutputSchema,
  },
  async (input: ExtractIdInfoInput) => {
    const {output} = await prompt(input);
    return output!;
  }
);
