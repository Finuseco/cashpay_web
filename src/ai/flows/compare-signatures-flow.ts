'use server';
/**
 * @fileOverview An AI agent for comparing two signature images for similarity.
 *
 * - compareSignatures - A function that handles the signature comparison.
 */

import {ai} from '@/ai/genkit';
import { CompareSignaturesInputSchema, CompareSignaturesOutputSchema, type CompareSignaturesInput, type CompareSignaturesOutput } from './types';


export async function compareSignatures(input: CompareSignaturesInput): Promise<CompareSignaturesOutput> {
  return compareSignaturesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'compareSignaturesPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: {schema: CompareSignaturesInputSchema},
  output: {schema: CompareSignaturesOutputSchema},
  prompt: `You are an expert forensic document examiner. Your task is to compare two handwritten signatures and determine if they were likely written by the same person.

Analyze the two images provided: Signature 1 is the reference signature on file, and Signature 2 is the new signature to be verified.

Look for similarities and differences in:
- Overall style and flow
- Letter shapes and connections
- Slant and baseline
- Pressure and stroke thickness

Based on your analysis, set 'areSimilar' to true if they are a likely match, and false otherwise. Provide a concise reason for your decision in French.

Signature 1 (Reference): {{media url=signature1DataUri}}
Signature 2 (New): {{media url=signature2DataUri}}`,
});

const compareSignaturesFlow = ai.defineFlow(
  {
    name: 'compareSignaturesFlow',
    inputSchema: CompareSignaturesInputSchema,
    outputSchema: CompareSignaturesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
