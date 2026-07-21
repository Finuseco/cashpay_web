
'use server';
/**
 * @fileOverview An AI agent for generating chat responses.
 *
 * - generateChatResponse - A function that generates a response based on conversation history and a system prompt.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { getAuthenticatedUser } from '@/lib/actions/user.actions';

const MessagePartSchema = z.object({
    text: z.string().optional(),
    media: z.object({
        url: z.string(),
        contentType: z.string().optional(),
    }).optional(),
    toolRequest: z.any().optional(),
    toolResponse: z.any().optional(),
});

const MessageSchema = z.object({
  role: z.enum(['user', 'model', 'tool']),
  content: z.array(MessagePartSchema),
});

const ChatInputSchema = z.object({
  history: z.array(MessageSchema),
  systemPrompt: z.string().describe("The instruction or persona for the AI to adopt."),
});

// Tool to get information about the user the AI is representing
const getUserProfileInfo = ai.defineTool(
  {
    name: 'getUserProfileInfo',
    description: 'Get information about the user you are representing, such as their schedule, contact details, or professional status.',
    inputSchema: z.object({}), // No input needed
    outputSchema: z.object({
      fullName: z.string(),
      walletId: z.string(),
      profession: z.string().optional(),
      bio: z.string().optional(),
      schedule: z.array(z.object({ day: z.string(), start: z.string(), end: z.string() })).optional(),
      availability: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      representative: z.object({ name: z.string(), contact: z.string() }).optional(),
    }),
  },
  async () => {
    // In a real app, this would fetch the authenticated user's data from a database.
    const storedProfile = await getAuthenticatedUser(); 
    if (!storedProfile) {
        throw new Error("User not authenticated to get profile info.");
    }
    return {
        fullName: storedProfile.full_name,
        walletId: storedProfile.id_wallet,
        profession: storedProfile.profession,
        bio: storedProfile.activity_description,
        schedule: storedProfile.schedule,
        availability: storedProfile.availabilityStatus,
        email: storedProfile.email,
        phone: storedProfile.phone,
        representative: storedProfile.representative,
    };
  }
);


export const generateChatResponse = ai.defineFlow(
  {
    name: 'generateChatResponse',
    inputSchema: ChatInputSchema,
    outputSchema: z.string(), // The flow will now directly return a string
  },
  async ({ history, systemPrompt }) => {
    
    // The 'system' parameter is not supported by gemini-pro.
    // We will prepend the system prompt to the history.
    const messages = [
        { role: 'user' as const, content: [{ text: systemPrompt }] },
        { role: 'model' as const, content: [{ text: 'Understood. I will act as instructed.' }] },
        ...history
    ];

    const llmResponse = await ai.generate({
      model: 'googleai/gemini-pro',
      prompt: {
        history: messages,
        tools: [getUserProfileInfo],
      },
      config: {
        temperature: 0.5,
      },
    });

    return llmResponse.text; // Return only the text string
  }
);
