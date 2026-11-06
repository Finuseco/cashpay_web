# Wallet Best : ouverture des crédits, session Shopping et contacts

Le parcours des routes a été revérifié avant les changements Android. Les prêts restent servis par les routes privées `/api/v1/loans/offer`, `/current`, `/history` et leurs opérations de devis/demande/remboursement existantes. Cette correction ne modifie ni les calculs ni les conditions du crédit.

Les lectures Shopping sont explicitement dynamiques. La réponse boutiques contient désormais `account` (ID, ID Wallet, rôle du compte authentifié) et `loadedAt`, avec `Cache-Control: private, no-store`. Le propriétaire vient exclusivement du jeton vérifié et du compte relu en base. Les paramètres `agentId`, `walletId` ou les en-têtes déclaratifs Android ne donnent aucun droit et ne déplacent pas une boutique. Les contrôles Agent tolèrent les espaces de bord et la casse, sans ouvrir les opérations à d’autres rôles. Les boutiques existantes restent listées ; en créer une autre ne les remplace pas.

Le contrat contacts conserve les numéros d’entrée et les profils publics minimaux, enrichis du pays et de l’alias `profilePhotoUrl` attendu par Android. Les correspondances exigent un compte actif, un numéro international complet et une identité non ambiguë. Aucune recherche par simple suffixe ni solde n’est exposé. Les espaces du pays sont normalisés.

Déployer d’abord cette branche backend, puis reconstruire et distribuer Wallet Best depuis `codex/wallet-contracts-realtime`. Une ancienne application installée n’est pas mise à jour par un simple déploiement Web. Aucune nouvelle table/colonne SQL n’est nécessaire.

Vérifications sur PostgreSQL isolé et routes réelles : boutiques existantes/ajout d’une boutique supplémentaire, isolation de propriétaire malgré des paramètres falsifiés, rôle Agent, 401/403, panne SQL, profils minimaux sans cache, formats téléphoniques internationaux/nationaux, collisions, comptes bloqués et champs avatars. Aucun compte, fournisseur ou base de production utilisé ; scénarios hors du dépôt.
