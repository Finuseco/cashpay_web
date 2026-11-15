// Read-only configuration check. Never print or replace custody material.
const path = require('node:path');
require('@next/env').loadEnvConfig(path.resolve(__dirname, '../..'), false, {info(){},error(){}});
const {TronWeb} = require('tronweb');
const phrase = process.env.TRON_HD_MNEMONIC?.trim().replace(/\s+/g, ' ');
if (!phrase) {
  console.log('USDT: SECURE_KEY_CUSTODY_NOT_CONFIGURED — configuration de conservation absente.');
  process.exitCode = 1;
} else {
  try {
    const wallet = TronWeb.fromMnemonic(phrase, "m/44'/195'/0'/0/1");
    if (!TronWeb.isAddress(wallet.address)) throw new Error('invalid');
    console.log('USDT: dérivation locale valide. Aucune clé affichée, aucune adresse enregistrée.');
  } catch {
    console.log('USDT: INVALID_KEY_CUSTODY_CONFIGURATION — vérifier la configuration existante avec son détenteur. Ne pas la remplacer automatiquement.');
    process.exitCode = 1;
  }
}
if (!process.env.TRON_FULL_HOST) {
  console.log('USDT: TRON_FULL_HOST absent — accès au réseau indisponible.');
  process.exitCode = 1;
}
console.log('Ce contrôle ne vérifie ni la base de données ni les confirmations réseau.');
