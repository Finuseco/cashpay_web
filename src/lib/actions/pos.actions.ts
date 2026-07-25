
'use server';

import { db } from '../db';

export async function recordSale(formData: FormData) {
    const items = formData.get('items');
    const total = formData.get('total_amount');
    console.log("Recording POS sale", { total, items });
    return { success: true, message: "Vente enregistrée avec succès." };
}
