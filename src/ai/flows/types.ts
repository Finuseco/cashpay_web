import { z } from 'zod';

export const ValidateProfilePhotoInputSchema = z.object({
  photoDataUri: z.string().describe("A photo of a person, as a data URI."),
});
export type ValidateProfilePhotoInput = z.infer<typeof ValidateProfilePhotoInputSchema>;

export const ValidateProfilePhotoOutputSchema = z.object({
  isValid: z.boolean(),
  reason: z.string(),
});
export type ValidateProfilePhotoOutput = z.infer<typeof ValidateProfilePhotoOutputSchema>;


export const ValidateSignatureInputSchema = z.object({
  signatureDataUri: z.string().describe("An image of a handwritten signature, as a data URI."),
});
export type ValidateSignatureInput = z.infer<typeof ValidateSignatureInputSchema>;

export const ValidateSignatureOutputSchema = z.object({
  isValid: z.boolean(),
  reason: z.string(),
});
export type ValidateSignatureOutput = z.infer<typeof ValidateSignatureOutputSchema>;


export const CompareSignaturesInputSchema = z.object({
  signature1DataUri: z.string(),
  signature2DataUri: z.string(),
});
export type CompareSignaturesInput = z.infer<typeof CompareSignaturesInputSchema>;

export const CompareSignaturesOutputSchema = z.object({
  areSimilar: z.boolean(),
  reason: z.string(),
});
export type CompareSignaturesOutput = z.infer<typeof CompareSignaturesOutputSchema>;

export const ExtractIdInfoInputSchema = z.object({
  idCardDataUri: z.string(),
});
export type ExtractIdInfoInput = z.infer<typeof ExtractIdInfoInputSchema>;

export const ExtractIdInfoOutputSchema = z.object({
  fullName: z.string(),
  idNumber: z.string(),
  isDocumentValid: z.boolean(),
});
export type ExtractIdInfoOutput = z.infer<typeof ExtractIdInfoOutputSchema>;


export const GenerateProfilePhotoInputSchema = z.object({
  gender: z.enum(['homme', 'femme']),
  race: z.enum(['noir', 'blanc']),
  nationality: z.string(),
});
export type GenerateProfilePhotoInput = z.infer<
  typeof GenerateProfilePhotoInputSchema
>;

export const GenerateProfilePhotoOutputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "The generated image as a data URI: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateProfilePhotoOutput = z.infer<
  typeof GenerateProfilePhotoOutputSchema
>;
