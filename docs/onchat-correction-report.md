# OnChat: contrats vérifiés et corrections

Base: `main`, branche `codex/fix-onchat-backend`.

## Contrats vérifiés dans le code

- Authentification: JWT `cashpay-token`; Bearer désormais accepté également par `getAuthenticatedUser`, la vérification du PIN courant et `/ws`. L'identifiant de portefeuille seul ne constitue pas une authentification.
- `GET /api/v1/chat/conversations`: conversations privées avec `contact`, `lastMessage` objet et compte non lu.
- `GET /api/v1/chat/conversations/:id`: contrôle de participation, messages avec métadonnées objet.
- `POST /api/v1/chat/conversations/:id`: `content`, `type`, `fileDataUri`, `fileName`; ajout de `fileUrl` provenant du stockage du compte expéditeur. Types texte/image/audio/vidéo/document. Réponse `success`, `message`, métadonnées objet.
- `POST /api/v1/media/upload`: le champ `video` conserve la publication publique existante. Le champ `file` stocke une pièce jointe privée et retourne `url`, `fileName`, `mimeType`, `fileSize`. Limites: 200 Mio vidéo, 25 Mio autres fichiers, liste MIME explicite, extension générée par MIME. Ce changement distingue volontairement pièces jointes et publication; les clients historiques publiant via `file` doivent utiliser `video` ou `/api/v1/media/videos`.
- `GET /api/uploads/onchat/:owner/:filename`: propriétaire authentifié ou participant à une conversation contenant cette référence; cache privé désactivé. Stockage dans `storage/onchat`, hors `public`; prévoir un volume persistant avant déploiement.
- `POST /api/v1/media/videos`: publication vidéo multipart existante. `GET`: vidéos publiques non expirées, interactions et pagination.
- Profil: médias personnels, sélection photo/couverture limitée au propriétaire; recherche publique par téléphone existante.
- Appels: initiate/respond/end/history conservent leurs contrats de statut et utilisent désormais le portefeuille de la session authentifiée. Les identifiants client ne permettent plus d'agir comme un autre compte.
- Réunions: create/list/status/join/participants/leave/end et extensions facturation/parole existantes. Admission WebSocket limitée à l’hôte ou à un participant HTTP actif. Audit complémentaire nécessaire sur paiement concurrent et fermeture des salles déjà connectées.
- WebSocket: `/ws`, hôte local configurable, port 3101 par défaut; événements `chat.typing`, `chat.read`, `call.*`, `meet.*` dans `{event,data}`. L'URL publique doit être confirmée côté déploiement; aucune adresse locale n'est fournie à Android.
- Notifications REST: authentification utilisateur et marquage lu limité à son compte.
- Groupes: routes existantes appellent les actions de contrôle des membres/administrateurs.

## Validation de cette phase

- `npm ci --no-audit --no-fund`: réussi.
- `npx tsx --test tests/*.test.ts`: 7 tests réussis (propriétaire, type/taille, URI, authentification appels, création message, téléchargement privé).
- `node --check server/onchat/ws-server.js`: réussi.
- `npm run build`: réussi, mais la configuration existante désactive types/lint et produit des avertissements d'exports manquants.
- `npx tsc --noEmit --pretty false`: échec préexistant de syntaxe dans `paypal.ts`, `src/components/crypto/bitcoin-balance-card.tsx`, `src/components/events/layout.tsx`.
- `npm run lint`: configuration ESLint absente; commande interactive, aucune validation lint effective.
- Aucun parcours connecté à PostgreSQL, aucun appel WebRTC réel, aucune notification système ni validation sur deux comptes réels. Aucune production ni migration exécutée.

## Travail restant

L'audit complet des dépendances indirectes et des 17 fonctionnalités n'est pas terminé. Notamment: admission des réunions et paiement, présence limitée aux contacts, notification push native, contrats profils/groupes/statuts et tests réels multi-comptes. Les changements ne constituent pas une validation de production. Les données de stockage doivent être conservées et partagées entre instances; le dépôt n'ajoute pas de migration de schéma.

## Synchronisation HTTP / WebSocket

Ajout de PostgreSQL LISTEN/NOTIFY sans colonne ni migration: postMessage notifie un identifiant dans sa transaction; le processus WebSocket recharge le message et ses destinataires après commit. Reconnexion du listener en cas de panne. Le test isolé vérifie le relais et la destination, mais une validation avec PostgreSQL reste nécessaire.

Publication GitHub refusée: push HTTPS HTTP 403; création de branche via connecteur GitHub HTTP 403 `Resource not accessible by integration`. Aucun push ni PR réussi.
