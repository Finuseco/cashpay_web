# Crypto : BTC et USDT (TRC-20)

## Bitcoin (nœud Bitcoin Core)
Variables : `BITCOIN_RPC_USER`, `BITCOIN_RPC_PASSWORD`, `BITCOIN_RPC_HOST`, `BITCOIN_RPC_PORT`,
`BITCOIN_RPC_WALLET` ; optionnelle : `BITCOIN_RPC_WALLET_PASSPHRASE` (portefeuille chiffré, déverrouillé 30 s par envoi).

Retrait externe (`POST /api/v1/transfers`, `currency: "BTC"`, adresse hors CashPay) :
1. validation de l'adresse et vérification de la liquidité du nœud (sinon « Aucun débit effectué ») ;
2. réservation du solde (montant + frais) en base ;
3. envoi au nœud avec la référence CashPay en commentaire ;
4. erreur RPC explicite du nœud → remboursement automatique ; pas de réponse → reste `pending`
   (jamais remboursé sans vérification), puis finalisé automatiquement dès que le nœud montre l'envoi.

## USDT TRC-20
Variables (serveur uniquement, **jamais dans Git**) :
| Variable | Rôle |
|---|---|
| `TRON_FULL_HOST` | nœud/API TRON (ex. `https://api.trongrid.io`, ou `https://nile.trongrid.io` pour les tests) |
| `TRON_API_KEY` | clé TronGrid (recommandée) |
| `TRON_HD_MNEMONIC` | phrase secrète qui dérive l'adresse de dépôt de chaque utilisateur (`m/44'/195'/0'/0/<id>`). À sauvegarder hors ligne. |
| `TRON_PRIVATE_KEY` | clé du portefeuille chaud qui paie les retraits externes |
| `USDT_SCAN_SECRET` | secret de la tâche planifiée |
| `USDT_TRC20_CONTRACT` | optionnelle (défaut : contrat officiel mainnet, ou Nile si l'hôte contient « nile ») |
| `USDT_MIN_EXTERNAL_WITHDRAWAL` (1), `TRON_MIN_TRX_RESERVE` (40), `TRON_FEE_LIMIT_SUN`, `TRON_WITHDRAWAL_EXPIRY_MINUTES` (30) | réglages optionnels |
| `USDT_SWEEP_ENABLED=true` (+ `USDT_SWEEP_*`) | balayage des dépôts vers le portefeuille chaud (désactivé par défaut) |

Sans `TRON_HD_MNEMONIC`, aucune adresse n'est créée (jamais d'adresse fictive). Sans `TRON_PRIVATE_KEY`
ou sans liquidité (USDT + TRX) sur le portefeuille chaud, les retraits externes sont refusés **avant** tout débit.

Routes mobiles (Android/iOS) : `POST /api/v1/crypto/usdt-trc20/address`, `GET .../balance`, `GET .../deposits`,
`POST /api/v1/transfers` avec `currency: "USDT"` (interne instantané, ou externe TRON).
Les transferts crypto n'ont pas d'aperçu : `preview: true` est refusé.

Tâche planifiée : installer `scripts/cron/usdt-trc20.cron` (dépôts + retraits en attente chaque minute, balayage toutes les 10 min).

**Avant la production : tester sur Nile (testnet)** — création d'adresse, dépôt, retrait externe, balayage.
