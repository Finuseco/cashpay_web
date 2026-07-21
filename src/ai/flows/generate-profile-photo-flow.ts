
'use server';
/**
 * @fileOverview An AI flow for generating a temporary user profile photo.
 *
 * - generateProfilePhoto - A function that generates a realistic portrait.
 */
import { ai } from '@/ai/genkit';
import { GenerateProfilePhotoInputSchema, GenerateProfilePhotoOutputSchema, type GenerateProfilePhotoInput, type GenerateProfilePhotoOutput } from './types';


export async function generateProfilePhoto(
  input: GenerateProfilePhotoInput
): Promise<GenerateProfilePhotoOutput> {
  return generateProfilePhotoFlow(input);
}

const generateProfilePhotoFlow = ai.defineFlow(
  {
    name: 'generateProfilePhotoFlow',
    inputSchema: GenerateProfilePhotoInputSchema,
    outputSchema: GenerateProfilePhotoOutputSchema,
  },
  async ({ gender, race, nationality }: GenerateProfilePhotoInput): Promise<GenerateProfilePhotoOutput> => {
    const prompt = `Générez UNIQUEMENT une image. La sortie doit être une image, pas du texte.
    Créez une photo de profil de style **avatar 3D réaliste**, ressemblant à une photo d'identité (passeport).

**Instructions strictes :**
1.  **Personnage :** Un(e) seul(e) ${gender} adulte d'origine ${race} et de nationalité ${nationality}.
2.  **Pose :** Prise de vue frontale (headshot), regardant droit devant, sans inclinaison de la tête.
3.  **Expression :** L'expression du visage doit être neutre, sans sourire.
4.  **Accessoires :** Absolument SANS chapeau, casquette, ou lunettes.
5.  **Habillement :** Le personnage doit porter un t-shirt simple de couleur unie avec le logo "CashPay" clairement visible sur le torse.
6.  **Arrière-plan :** Un fond de couleur unie et neutre (comme gris clair ou bleu clair).`;

    const { media } = await ai.generate({
      model: 'googleai/gemini-1.5-flash-latest',
      prompt: prompt,
      config: {
        responseModalities: ['IMAGE'], // Explicitly request an image output
      },
    });

    if (!media || !media.url) {
        throw new Error("L'IA n'a pas pu générer d'image.");
    }

    return { photoDataUri: media.url };
  }
);
