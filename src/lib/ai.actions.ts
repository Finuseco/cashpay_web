
'use server';

import { generateChatResponse } from '@/ai/flows/chat-flow';
import { textToSpeech } from '@/ai/flows/text-to-speech-flow';
import { transcribeAudio } from '@/ai/flows/speech-to-text-flow';
import { GenerateProfilePhotoInput, ValidateProfilePhotoInput, ValidateSignatureInput, ExtractIdInfoInput } from '@/ai/flows/types';
import { generateProfilePhoto as generateProfilePhotoFlow } from '@/ai/flows/generate-profile-photo-flow';
import { validateProfilePhoto as validateProfilePhotoFlow } from '@/ai/flows/validate-profile-photo-flow';
import { validateSignature as validateSignatureFlow } from '@/ai/flows/validate-signature-flow';
import { extractIdInfo as extractIdInfoFlow } from '@/ai/flows/extract-id-info-flow';
import type { User, Conversation, Message, AssistantSettings } from '@/lib/types';


export async function transcribeVoiceMessage(audioDataUri: string): Promise<string> {
    const result = await transcribeAudio({ audioDataUri });
    return result.transcription;
}

export async function getAiChatResponse(
  conversation: Conversation,
  assistantSettings?: AssistantSettings | null
): Promise<string> {
  // 1. Check if the assistant should respond with a custom message
  const dayOfWeek = new Date().toLocaleString('en-US', { weekday: 'long' });
  const isAssistantActiveToday = assistantSettings?.isEnabled && assistantSettings.activeDays.includes(dayOfWeek);

  if (isAssistantActiveToday && assistantSettings.customMessage) {
    // Return the custom message
    return assistantSettings.customMessage;
  }

  // 2. If not, generate a conversational response
  const historyForAi = conversation.messages
    .filter((m: Message) => m.content && m.content.trim() !== '' && m.type === 'text') 
    .map((m: Message) => ({
      role: m.senderId === conversation.userId ? ('user' as const) : ('model' as const),
      content: [{ text: m.content }],
    }));
  
  const systemPrompt = `You are ${conversation.contact.full_name}, a personal assistant. Respond naturally to the user's message in the context of the conversation history. Keep your responses concise and helpful. Use the getUserProfileInfo tool to answer any questions about your (the user you are representing) availability, schedule, contact information, or professional status. Do not guess this information; always use the tool. The user's language is likely French, but you should respond in whatever language they use.`;

  const aiResponse = await generateChatResponse({
    history: historyForAi,
    systemPrompt: systemPrompt
  });
  
  return aiResponse;
}

export async function getAiSpokenResponse(text: string): Promise<{ audioDataUri: string }> {
    const result = await textToSpeech(text);
    return { audioDataUri: result.audioDataUri };
}

export async function generateProfilePhoto(input: GenerateProfilePhotoInput) {
    return await generateProfilePhotoFlow(input);
}

export async function validateProfilePhoto(input: ValidateProfilePhotoInput) {
    return await validateProfilePhotoFlow(input);
}

export async function validateSignature(input: ValidateSignatureInput) {
    return await validateSignatureFlow(input);
}

export async function extractIdInfo(input: ExtractIdInfoInput) {
    return await extractIdInfoFlow(input);
}
