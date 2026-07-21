
# Spécifications API Smart Fuel Network v1.0 (IoT)

Cette documentation définit l'interface de communication entre les serveurs CashPay et les bornes de distribution de carburant connectées.

## 1. Gateway des Pompes (`pump.cashpay.cd`)
Destinée aux automates physiques pour l'autorisation et la télémétrie.

### A. Validation de Jeton (Activation)
La borne appelle cet endpoint pour vérifier si un code saisi par le client est valide.

**Endpoint:** `POST /v1/pumps/authorize`  
**Auth:** API Key (Hardware Serial)  
**Payload:**
```json
{
  "tokenCode": "FP-8745-6632",
  "pumpId": "PUMP_GOMBE_01"
}
```
**Réponse (Success):**
```json
{
  "success": true,
  "action": "DISPENSE",
  "liters": 12.50,
  "productType": "Essence",
  "maxFlowRate": "40L/min"
}
```

### B. Rapport de Distribution (Fin de service)
Appelé par la pompe une fois le pistolet raccroché pour confirmer le volume réel servi.

**Endpoint:** `POST /v1/pumps/dispense/complete`  
**Payload:**
```json
{
  "pumpId": "PUMP_GOMBE_01",
  "tokenCode": "FP-8745-6632",
  "litersDelivered": 12.48,
  "durationSeconds": 45
}
```
*Note: Le système CashPay ajuste le débit final et libère les fonds séquestrés.*

---

## 2. API de Gestion de Station (`fuel.cashpay.cd`)
Destinée aux systèmes de gestion d'entreprise (ERP) et au tableau de bord Super Agent.

### A. Monitoring des Stocks (Tanks)
Récupère les niveaux réels des cuves transmis par les sondes connectées.

**Endpoint:** `GET /v1/stations/{id}/stocks`  
**Réponse:**
```json
{
  "stationId": "ST_001",
  "tanks": [
    { "id": "T01", "product": "Essence", "level": "85%", "volume": 8500.00, "capacity": 10000 },
    { "id": "T02", "product": "Gasoil", "level": "42%", "volume": 12600.00, "capacity": 30000 }
  ]
}
```

### B. Télémétrie en Temps Réel
Données d'utilisation brute pour l'analyse prédictive.

**Endpoint:** `POST /v1/telemetry/heartbeat`  
**Payload:**
```json
{
  "stationId": "ST_001",
  "systemStatus": "OK",
  "pumps": [
    { "id": "P01", "status": "idle" },
    { "id": "P02", "status": "busy", "currentLiters": 5.4 }
  ]
}
```

---

## 3. Sécurité Souveraine
- **Isolation des Réseaux** : Les bornes ne voient jamais le solde des clients, seulement l'autorisation de volume.
- **Atomicité** : La réduction du stock en base de données CashPay est liée au rapport de fin de distribution (`DISPENSE_COMPLETE`).
- **Mode Offline** : En cas de coupure internet, les pompes stockent les transactions locales et les synchronisent dès le rétablissement via un canal de repli GSM.
