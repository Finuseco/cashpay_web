
# Spécifications du Pont API Starlink v1

Ce document définit les points d'entrée (ports) pour l'application mobile permettant la transmission, le stockage et la récupération des identifiants Starlink Enterprise.

## 1. Pont de Configuration (Data Bridge)
Ce port permet à l'application d'envoyer les identifiants vers le Vault sécurisé de CashPay.

**Endpoint:** `POST /api/v1/starlink/reseller/config`
**Headers:**
- `X-CashPay-Signature`: Signature HMAC-SHA256 (Clé Secrète Application)
- `X-CashPay-Timestamp`: Timestamp UNIX
- `Authorization`: Bearer {JWT_TOKEN}

**Payload (JSON):**
```json
{
  "companyName": "Nom de votre Entreprise",
  "merchantWalletId": "CD010000XXXX", 
  "starlinkClientId": "votre_client_id_starlink",
  "starlinkClientSecret": "votre_client_secret_starlink"
}
```
*Note: Le secret est immédiatement chiffré en AES-256 par le serveur avant d'être écrit en base de données.*

## 2. Pont d'Authentification (Recovery)
Permet à l'application mobile de récupérer ses identifiants lors d'une nouvelle session pour s'authentifier auprès de `https://starlink.com/api/auth/connect/token`.

**Endpoint:** `GET /api/v1/starlink/reseller/config`

**Réponse (JSON):**
```json
{
  "success": true,
  "configured": true,
  "data": {
    "companyName": "Nom de votre Entreprise",
    "merchantWalletId": "CD010000XXXX",
    "starlinkClientId": "votre_client_id_starlink",
    "starlinkClientSecret": "secret_dechiffre_pour_usage"
  }
}
```

## 3. Paiement Souverain (Sovereign Billing)
Permet de déclencher un transfert de fonds interne pour le réabonnement d'un client.

**Endpoint:** `POST /api/v1/starlink/billing/pay`
**Payload:**
```json
{
  "terminalId": "ut00000000",
  "amount": 50,
  "currency": "USD",
  "pin": "1234"
}
```

---
*Ce pont garantit que les clés critiques ne sont jamais exposées en clair côté client et centralise la facturation sur le réseau souverain CashPay.*
