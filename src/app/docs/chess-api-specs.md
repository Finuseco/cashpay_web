
# Spécifications API Chess Match v1 (Mobile)

Cette API permet d'orchestrer des parties d'échecs monétisées entre les utilisateurs de l'application mobile CashPay.

## 0. Authentification Souveraine (Login)
Toutes les applications de l'écosystème utilisent le même portail d'identité.

### Étape 1 : Identification
**Endpoint:** `POST /api/v1/auth/login`
**Payload:** `{ "walletId": "CD0100001234" }`
**Réponse:** `{ "success": true, "userId": 456, "maskedPhone": "*******8021", "availableChannels": ["sms", "whatsapp"] }`

### Étape 2 : Validation (PIN ou OTP)
**Option PIN:** `POST /api/v1/auth/pin/verify`
**Payload:** `{ "userId": 456, "pin": "1234" }`

**Option OTP:** `POST /api/v1/auth/otp/verify`
**Payload:** `{ "userId": 456, "otp": "654321" }`

**Réponse (Succès):** 
```json
{
  "success": true,
  "token": "JWT_TOKEN_HERE",
  "user": { "id_wallet": "CD...", "full_name": "..." }
}
```
*Le `token` doit être envoyé dans le header `Authorization: Bearer {token}` pour toutes les requêtes suivantes.*

## 1. Création d'une Partie (Bet Setup)
Initialise la mise et génère un code d'invitation.

**Endpoint:** `POST /api/v1/games/chess/create`
**Payload:**
```json
{
  "betAmount": 5000.00,
  "currency": "CDF"
}
```
*Note: Le serveur vérifie que le solde est suffisant avant de créer le code.*

## 2. Rejoindre une Partie
Le second joueur rejoint en utilisant le code.

**Endpoint:** `POST /api/v1/games/chess/join`
**Payload:**
```json
{
  "gameCode": "CHX7Y8Z"
}
```
*Action: Le montant de la mise est virtuellement "bloqué" pour les deux joueurs.*

## 3. Synchronisation & Mouvements
Transmission des coups via le serveur.

**Mouvement:** `POST /api/v1/games/chess/move`
**Payload:**
```json
{
  "gameId": 123,
  "move": { "from": {"row": 6, "col": 4}, "to": {"row": 4, "col": 4} },
  "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
}
```

## 4. Résolution & Règlement (Paiement)
Déclenche le transfert de fonds souverain.

**Endpoint:** `POST /api/v1/games/chess/resolve`
**Payload:**
```json
{
  "gameId": 123,
  "winnerId": 456
}
```
*Souveraineté : Le serveur vérifie l'état final, débite le perdant et crédite instantanément le gagnant.*

---
*Toutes les requêtes doivent inclure les headers de sécurité `X-CashPay-Signature` et `Authorization`.*
