
'use server';

import { db } from '../db';

export async function openCashRegister(data: { userId: number; storeId: number; openingBalance: number }) {
    console.log("Opening cash register", data);
    return { success: true };
}

export async function closeCashRegister(sessionId: number) {
    console.log("Closing cash register session", sessionId);
    return { success: true };
}
