# Recouvrement des prêts après sept jours de grâce

Le recouvrement automatique traite les échéances impayées dont la date est antérieure ou égale à la date courante moins sept jours. Il ne dépend pas du nom du jour et ne recherche pas seulement les prêts récents. Les prêts `approved`, `defaulted` et les anciens états textuels `overdue` restent recouvrables après la fin du contrat. Les prêts en attente, rejetés ou déjà soldés ne sont pas débités.

Le moteur applique la pénalité configurée `PENALTY` avant de calculer le remboursement, pour que le règlement puisse solder principal et pénalités ensemble. Elle ne commence pas avant la fin de la grâce, ne se répète pas dans une même période et conserve l’intervalle existant `LOAN_PENALTY_INTERVAL_DAYS` (sept jours par défaut). Une remise en service après une longue interruption applique au maximum la pénalité courante ; elle ne facture pas rétroactivement toutes les semaines pendant lesquelles l’agent était arrêté.

Le montant remboursable tient compte du solde et des frais `LR`, dans la devise du prêt uniquement. Un dépôt partiel peut donc produire un remboursement partiel, frais inclus. Les soldes en d’autres devises ne sont pas convertis sans consentement. Un savepoint annule toute écriture partielle si le moteur de transaction refuse le prélèvement. Les verrous des prêts/échéances et les dates de pénalité protègent les passages répétés. Un passage sans dette à prélever est un succès avec zéro prélèvement.

Chaque titulaire est traité dans sa propre transaction. Un échéancier absent ou une erreur chez un client ne peut plus annuler les remboursements des autres. Un échéancier manquant ou un écart entre dette et échéancier est signalé et reste à rapprocher avec les paiements ; le service ne fabrique pas de nouvelles échéances à partir du montant restant. Les prélèvements manuels de supervision passent par le même moteur après les contrôles de rôle, de territoire et de PIN.

## Déclenchement permanent

La nouvelle migration crée une file `loan_repayment_queue`, une fonction et un trigger sur les portefeuilles. Une augmentation de solde ajoute ou actualise le titulaire dans la file et émet un signal PostgreSQL après commit. Le trigger ne débite jamais d’argent. Il couvre les crédits qui passent par le moteur de transaction comme les crédits réalisés directement par les autres services dans `wallets.balances`. La file reçoit les droits des rôles qui disposent déjà des écritures sur les portefeuilles.

Le processus PM2 `cashpay-loan-repayments` écoute ces signaux et appelle la route interne authentifiée. Il effectue aussi une vérification au démarrage et chaque minute, ce qui permet de reprendre les anciennes dettes et les signaux manqués. Les appels sont regroupés si plusieurs dépôts arrivent pendant un passage. Une nouvelle entrée de file arrivée pendant un recouvrement n’est pas supprimée par le nettoyage de ce passage. Les erreurs partielles sont retournées comme échecs par l’API interne et restent à reprendre.

Le worker utilise les fichiers d’environnement existants, avec la même priorité `.env.production` puis `.env`, sans les modifier. Il reprend `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, éventuellement `DB_SSL_CA`, `CASH_PAY_APP_URL` (loopback port 8002 par défaut) et `INTERNAL_JOB_SECRET`, déjà utilisé par la route interne. Aucun secret n’est affiché. Aucune nouvelle dépendance npm.

## Installation serveur

1. Mettre à jour et compiler CashPay Web depuis `codex/super-agent-operations`, puis redémarrer `cashpay-wallet` uniquement si le build réussit.
2. Exécuter dans Adminer [20261106_loan_repayment_queue.sql](../migrations/20261106_loan_repayment_queue.sql), avec le propriétaire du schéma ou un compte autorisé à créer le trigger. Le schéma d’échéanciers existant doit aussi être installé : [20261101_loan_runtime_schema.sql](../migrations/20261101_loan_runtime_schema.sql).
3. Démarrer le worker depuis le clone Web :

```bash
cd /var/www/cashpay-all/wallet
pm2 startOrReload server/loans/ecosystem.config.cjs
pm2 save
pm2 logs cashpay-loan-repayments --lines 30 --nostream
```

Le premier passage peut effectuer de vrais prélèvements sur les dettes éligibles existantes. Ce déploiement n’a pas été exécuté sur la production pendant le développement.

## Calendrier

Les échéanciers gardent leurs dates contractuelles. Un prêt d’un mois conserve ses échéances hebdomadaires à sept jours d’intervalle depuis l’approbation : une approbation le mardi donne des échéances le mardi. Les prêts mensuels/trimestriels conservent leurs dates propres ; leur jour réel est affiché. Le nom du jour n’est jamais utilisé comme condition de recouvrement d’une dette déjà en retard.

Le Web et les rappels ajoutent le jour et la date complète ; USSD affiche le jour et la date sur deux échéances par page. Wallet Best ajoute également le jour et la date complète dans le prêt actif, l’historique et les échéances, sans décaler la date contractuelle selon le fuseau du téléphone. Ses conditions précisent la grâce de sept jours. Reconstruire et distribuer Android pour voir ce changement sur téléphone.

## Vérifications

PostgreSQL isolé : migration répétable et droits, signalement des crédits sans signaler les débits, prêt en défaut de 90 jours, frontière des sept jours, pénalité avant règlement, absence de doublon dans la période, reprise après dépôt, règlement partiel/frais/devise, échéancier manquant isolé, savepoint et route interne/gestion des files. Le véritable code du worker est exécuté avec HTTP/PG/horloges interceptés hors Git : démarrage, minute, signal, regroupement et arrêt propre. Compilation Kotlin et tests JVM du calendrier réel réussis (mardi/dimanche, dates invalides et plusieurs fuseaux). Régression des crédits USSD conservée. Aucun test ni dette fictive livré dans le code de production ; aucun prélèvement, SMS ou fournisseur de production utilisé.

Le contrôle TypeScript ciblé ne relève aucune erreur dans les fichiers modifiés. Le contrôle global du projet conserve les erreurs préexistantes hors de ce lot ; une compilation Web globale réussie n’est pas annoncée.
