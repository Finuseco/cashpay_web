# Agents inter et suivi client Wallet Best — vérification complémentaire

Les contrôles existants ont été vérifiés : quatre motifs de rejet reconnus et consignes détaillées, consultation nominative des captures et de la signature, financement avant dévoilement, affectation provinciale dans le pays et reprise financée par un responsable national. Les routes client restent liées au propriétaire de session et ne retournent pas les pièces KYC ni le journal interne.

Corrections supplémentaires :

- Les routes de liste/détail retournent aussi l'état réservé, le paiement terminé et le rejet du traitement inter ; une réservation n'est plus affichée « en attente ».
- Le paiement exige un nom complet, le type et le numéro de pièce, la capture et la signature renseignés avec des valeurs non vides. Les noms réduits uniquement à de la ponctuation ne permettent pas une concordance. Une date d'expiration reste valable jusqu'à la fin du jour UTC indiqué.
- L'agent voit les éléments d'identité manquants et la date de validité ; son tableau de bord utilise l'adresse du WebSocket partagé.
- Le suivi web affiche les libellés de traitement et le montant net, et se recharge lors d'un événement inter. Les réponses anciennes sont ignorées après changement de session ou requête plus récente.
- Wallet_best 12.3 applique le même état de traitement aux libellés et onglets actif/historique. Le détail affiche son chargement, signale une erreur et permet de réessayer ; une réponse tardive ne remplace pas un autre dossier ou compte. La page crédits permet d'actualiser offre, prêt courant et remboursements.

Aucune nouvelle table/colonne dans cette correction. Les prérequis restent `20261030_inter_agent_claims.sql`, puis `20261101_inter_agent_provinces.sql`. Aucun SQL ni encaissement externe exécuté en production. Les attestations humaines ne sont pas remplacées par une fausse validation Western Union/MoneyGram ou une IA.
