
'use server';
/**
 * @fileOverview An AI flow for transcribing audio to text.
 *
 * - transcribeAudio - A function that handles audio transcription.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const TranscribeInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "An audio recording, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type TranscribeInput = z.infer<typeof TranscribeInputSchema>;

const TranscribeOutputSchema = z.object({
  transcription: z.string().describe('The transcribed text from the audio.'),
});
export type TranscribeOutput = z.infer<typeof TranscribeOutputSchema>;

export async function transcribeAudio(
  input: TranscribeInput
): Promise<TranscribeOutput> {
  return transcribeAudioFlow(input);
}

const prompt = ai.definePrompt({
  name: 'transcribeAudioPrompt',
  model: 'googleai/gemini-1.5-flash-latest',
  input: { schema: TranscribeInputSchema },
  output: { schema: TranscribeOutputSchema },
  prompt: `Transcribe the following audio accurately and concisely.

Audio to transcribe: {{media url=audioDataUri}}`,
});

const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeInputSchema,
    outputSchema: TranscribeOutputSchema,
  },
  async (input: TranscribeInput) => {
    const { output } = await prompt(input);
    return output!;
  }
);
