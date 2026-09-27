import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "Fichier requis.",
        },
        { status: 400 }
      );
    }

    /*
     * Cette route constitue le point d'entrée OnChat.
     * Le stockage définitif doit utiliser le stockage média
     * déjà configuré dans CashPay.
     *
     * Aucun stockage local arbitraire n'est créé ici.
     */

    return NextResponse.json(
      {
        success: false,
        error:
          "Le stockage média CashPay existant doit être raccordé à cette route.",
      },
      { status: 501 }
    );
  } catch (error) {
    console.error("ONCHAT media upload:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de l'upload.",
      },
      { status: 500 }
    );
  }
}
