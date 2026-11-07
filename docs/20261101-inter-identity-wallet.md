# Réclamations inter, identité et crédits Wallet — 1 novembre 2026

## Traitement des réclamations

L’agent provincial ne voit et ne traite que les clients de sa province d’affectation, dans son pays. Le responsable inter nommé `supervisor` travaille au niveau national ; les Sous-Super Agents conservent leur limite provinciale. La nomination ne change pas le rôle financier existant du compte.

La consultation après réservation présente le nom complet, prénom/nom, type/numéro de pièce, et des liens authentifiés sans cache vers les captures et la signature stockées. L’accès aux médias est limité au dossier réservé et à l’agent ou à une supervision autorisée, puis journalisé. L’endpoint ne suit pas d’URL externe. Ce changement ne déplace pas les anciens fichiers du stockage public historique : une revue de ce stockage et des accès directs existants reste nécessaire. La présence d’une signature est une donnée enregistrée, pas une certification cryptographique.

Avant paiement, le serveur exige les confirmations de comparaison du nom, pièce, signature et référence, une pièce non expirée avec recto/numéro et une signature présentes, le nom bénéficiaire concordant (casse, accents et ponctuation normalisés), l’encaissement externe et le reçu. Ces attestations sont journalisées ; aucun fournisseur externe n’est simulé et aucune identité n’est déclarée vérifiée par IA.

Quatre raccourcis : identité non concordante, pièce non vérifiable, référence invalide, devise indisponible. Le code reconnu et une description détaillée sont obligatoires. Les consignes de correction sont stockées et renvoyées au client ; la notification interne et les tentatives mail/SMS/WhatsApp les reprennent. La réception effective dépend des fournisseurs configurés.

Le responsable national peut reprendre un dossier réservé non encaissé : son propre wallet finance la réservation et l’ancienne réservation est restituée atomiquement. Aucun transfert de responsabilité pour un dossier déjà encaissé, payé ou en litige. Les responsables doivent être explicitement nommés et disposer des fonds ; le rôle de superviseur ne permet pas de créditer gratuitement un client.

## Routes client et Wallet_best

Les GET `/api/v1/international-transfer/claims` et `/api/v1/international-transfer/claims/{id}` restent strictement liés à la session : état de traitement, motif détaillé et montant net sont renvoyés sans images KYC ni journal interne. La liste et le détail Wallet_best utilisent ces routes ; OnChat n’a pas été modifié dans cette phase. La nouvelle demande associe la pièce la plus récente du compte.

Crédits : le contrat existant utilise `remaining_balance`, `repaid_amount`, `principal_amount`, `installment_number`, `due_date`, `payment_date`. Wallet_best les lit désormais exactement. Le prêt courant expose aussi échéancier et remboursements, avec le principal réel. L’historique applique l’intérêt forfaitaire déjà utilisé à l’approbation, sans le multiplier une seconde fois par la durée. Les soldes et historiques existants ne sont pas réécrits. Les échéanciers anciens déjà enregistrés ne sont pas recalculés automatiquement.

## Migration et validation

Appliquer, après revue du schéma/sauvegarde, `migrations/20261101_inter_agent_provinces.sql`, après `20261030_inter_agent_claims.sql`. Un seul champ est ajouté : `inter_agent_memberships.province`. Les provinces des agents existants sont reprises depuis leur compte ; sans province, l’accès provincial est refusé jusqu’à affectation. Aucune migration n’a été exécutée en production.

Les vérifications temporaires hors dépôt utilisent PostgreSQL WASM et les fonctions/routes réelles, avec sessions et transports externes isolés : contrôles d’identité manquants, nom différent, province, reprise et conservation des soldes, idempotence, motifs autorisés, consignes mail, accès client propriétaire et refus des tiers, contrat du prêt courant et total forfaitaire. Le build web passe avec les avertissements préexistants. Ces vérifications ne remplacent pas des contrôles d’identité humains, un encaissement fournisseur ni un parcours sur téléphone en production.
