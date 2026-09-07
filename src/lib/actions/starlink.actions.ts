
'use server';

import { db } from '../db';

export async function orderStarlinkInstallation(data: any) {
    return { success: true, data: { orderId: 'INST-' + Date.now() } };
}

export async function linkStarlinkResellerAccount(user: any, data: any) {
    return { success: true, config: data, accountName: 'Starlink Enterprise' };
}

export async function linkClientStarlinkAccount(userId: number, kit: string) {
    return { success: true };
}

export async function getTerminalsForReseller(userId: number) {
    return { success: true, data: [] };
}

export async function getClientTerminalInfo(userId: number) {
    return { success: true, data: null };
}

export async function getResellerConfig(userId: number) {
    return null;
}

export async function getResellerConfigForApp(userId: number) {
    return null;
}

export async function saveResellerConfig(data: any) {
    return { success: true };
}

export async function saveSubCustomer(data: any) {
    return { success: true };
}

export async function registerTerminal(data: any) {
    return { success: true };
}

export async function processStarlinkSubscription(data: any) {
    return { success: true };
}

export async function getTerminalsForAccount(config: any) {
    return { success: true, data: [] };
}

export async function getBillingCycles(config: any) {
    return { success: true, data: [] };
}

export async function getStarlinkAlerts(config: any) {
    return { success: true, data: [] };
}

export async function rebootUserTerminal(accountId: string, terminalId: string) {
    return { success: true };
}

export async function setServiceLineNickname(accId: string, line: string, name: string) {
    return { success: true };
}

export async function setServiceLineProduct(accId: string, line: string, prod: string) {
    return { success: true };
}

export async function setPublicIp(accId: string, line: string, enabled: boolean) {
    return { success: true };
}

export async function topUpData(accId: string, line: string, gb: number) {
    return { success: true };
}

export async function setRecurringData(accId: string, line: string, gb: number) {
    return { success: true };
}

export async function cancelUserTerminal(accId: string, id: string) {
    return { success: true };
}

export async function optInToService(accId: string, line: string) {
    return { success: true };
}

export async function runDiagnostics(accId: string, id: string) {
    return { success: true, data: { diagnosticId: 'diag-123' } };
}

export async function getDiagnosticResults(accId: string, id: string, diagId: string) {
    return { success: true, data: { status: 'complete', results: { ping_stats: { drop_rate: 0, latency_ms: 20 }, obstruction: { fraction: 0 } } } };
}
