# Wallet Best : crédits, contacts et boutiques — 6 novembre 2026

## Contrats conservés et corrections

Les routes authentifiées `GET /api/v1/loans/offer`, `/current`, `/history`, `POST /request`, `GET|POST /repay` et `POST /repay-installment` restent les contrats des crédits. Le devis serveur, les conditions acceptées, la devise du prêt, les frais, les échéances, les soldes et les contrôles de propriété restent autoritaires. Une demande demeure soumise au processus d’approbation existant ; aucune approbation automatique ni nouveau taux arbitraire n’est ajouté.

Les lectures de crédit actuel et d’historique ne masquent plus une erreur SQL sous un crédit absent ou un historique vide. Les écrans Android peuvent présenter une erreur et proposer une nouvelle lecture.

Les routes privées boutiques et produits acceptent le rôle existant `Agent`, ainsi que sa graphie historique `agent`. L’utilisateur propriétaire vient de la session ; les paramètres walletId/agentId ne permettent pas de consulter ou modifier les boutiques d’un tiers. La route produits importe désormais `countryToCode` depuis le module qui l’exporte réellement. Une panne de lecture des produits n’est plus renvoyée comme un catalogue vide réussi.

## Résolution du répertoire

`POST /api/v1/contacts/resolve` exige une session et reçoit `{ "phoneNumbers": ["+...", "0..."] }`, au maximum 250 numéros par lot. Réponse : `{ success, contacts: [{ phone, found, profile }] }`. Le profil minimal contient `walletId`, `fullName`, `profilePhoto` et `role`. Aucun solde, document ou identité privée n’est renvoyé. Réponse `private, no-store`.

Le pays du demandeur interprète les numéros nationaux ; les formes internationales +/00 conservent leur indicatif. Les valeurs enregistrées sont comparées selon le pays du titulaire. Une égalité des neuf derniers chiffres ne suffit jamais ; plusieurs comptes correspondant au même numéro restent non résolus, plutôt que de sélectionner arbitrairement un bénéficiaire. Les numéros internationaux sont à privilégier, notamment pour les conventions nationales particulières. Aucun contact n’est inséré en base pendant cette opération.

La recherche individuelle `/api/v1/profile/by-phone` utilise aussi cette identité complète. Les appels anonymes historiques conservent CD comme pays national par défaut ; les autres pays doivent fournir l’indicatif international ou une session avec leur pays.

## Android et ordre de livraison

Déployer ce backend avant la nouvelle version de `Finuseco/Wallet_best`. L’application utilise la nouvelle route par lots jusqu’à la fin du répertoire, avec progression, déduplication par portefeuille, actualisation et erreur visible. Elle n’utilise plus des recherches de profils lourdes et concurrentes limitées aux 200 premiers contacts.

Le bouton Crédit ouvre l’écran complet depuis l’accueil. L’ancien dialogue est rendu à la racine pour les autres points d’entrée. Le chargement boutiques possède son état indépendant du chargement produits. Un refus réseau/serveur ne provoque plus une fausse invitation à recréer une boutique.

Aucune nouvelle table, colonne, enum ou migration SQL dans cette livraison. Aucun accès à la production, envoi de notification ou scénario de test livré dans le dépôt.

## Vérifications et limites

- Exécution des routes réelles sur PostgreSQL temporaire : numéros nationaux et internationaux, contacts étrangers enregistrés au format national, refus des collisions de suffixes, doublons ambigus, limites des lots, authentification et panne SQL.
- Boutiques et produits existants de l’agent, prix du catalogue et isolation entre propriétaires ; refus Client/non connecté et erreur visible si la table produits manque.
- Prêts : principal/intérêt, devise, dette, historique, échéances et remboursements ; régression du moteur transactionnel et des devis contre modification des prix/frais, débit du bon compte et retry.
- Syntaxe TypeScript des dix modules modifiés/ajoutés vérifiée. La vérification globale `tsc --noEmit --incremental false` reste bloquée par neuf erreurs de syntaxe déjà présentes dans HEAD : `paypal.ts`, `src/components/crypto/bitcoin-balance-card.tsx`, `src/components/events/layout.tsx`. Cette livraison ne prétend pas valider le build web complet.
- Compilation Android `:app:compileDebugKotlin` exécutée avec SDK 36.1. La validation tactile et visuelle sur téléphone réel et les opérations bancaires réelles restent à effectuer après installation.
