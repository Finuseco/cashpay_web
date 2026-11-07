# OnChat — réception et réunions sur le WebSocket partagé

## Corrections livrées

- OnChat Android 5.3 utilise par défaut `wss://app.cashpay-all.com/ws`, exactement comme Wallet_best. La propriété Gradle `onchatWsUrl` permet une configuration explicite.
- Les métadonnées des messages acceptent les nombres et objets réellement retournés par PostgreSQL. Les URL et noms des photos, audios, vidéos et documents sont également récupérés depuis `metadata`, en REST comme en WebSocket. Les erreurs de chargement de l'historique ne retournent plus un faux succès.
- Les messages reçus en arrière-plan sont enregistrés dans Room. L'insertion et le compteur de messages non lus sont transactionnels et utilisent l'identifiant serveur pour éviter les doubles comptages. À chaque connexion, l'historique de la conversation ouverte est resynchronisé.
- Le chat web reçoit les événements WebSocket puis recharge les messages autorisés via l'API. La liste des conversations se rafraîchit sans rechargement de page. Le polling reste un secours.
- Le raccordement aux réunions couvre aussi le cas où le WebSocket est déjà ouvert avant la pose du gestionnaire `onopen`. Un délai de 20 secondes et les erreurs de schéma interrompent l'attente infinie. Réessayer recharge le parcours d'admission, sans contourner PIN, billet ou autorisations de parole.
- Le serveur partagé transmet les notifications Wallet au format historique et les événements structurés OnChat. Wallet_best ignore désormais les trames techniques qui ne sont pas des notifications ; le contenu des messages n'est plus écrit dans ses logs Android.

## SQL à appliquer volontairement via Adminer

Exécuter sur la base utilisée par le backend et le WebSocket, dans cet ordre :

1. `migrations/20261030_onchat_meeting_schema_compatibility.sql` : `host_id`/`host_user_id`, `group_id`, tarifs et participants (`left_at`, `is_host`, `can_speak`, etc.). Ces colonnes correspondent aux erreurs de production fournies.
2. `migrations/20261030_onchat_direct_calls.sql` : relation appels/réunions et invitations.
3. `migrations/20261101_meeting_timestamps.sql` : dates réelles de début et fin.
4. `migrations/20261101_shared_realtime.sql` : notifications transactionnelles pour tous les chemins d'insertion de messages, groupes et notifications. Aucune nouvelle table ni colonne dans cette dernière migration.

Les tables existantes `users`, `groups`, `meetings`, `meeting_participants`, `events`, `call_logs`, `messages`, `group_messages` et `notifications` sont requises. Ces scripts ne créent pas de faux utilisateurs, soldes ou messages. Un doublon de participants peut empêcher la création de l'index unique : examiner ces lignes, sans les supprimer arbitrairement. Les scripts ne sont jamais lancés automatiquement par l'application.

## Routage indispensable sur le serveur

Changer uniquement l'adresse Android ne transforme pas un ancien serveur de notifications en serveur de visioconférence. Le `/ws` public de `app.cashpay-all.com` doit aboutir au serveur partagé livré ici, avec les mêmes base de données et `JWT_SECRET` que le backend. Préserver les autres routes HTTP du site.

Exemple de bloc Nginx à adapter dans le vhost existant :

```nginx
location = /ws {
    proxy_pass http://127.0.0.1:3101;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 75s;
    proxy_send_timeout 75s;
    proxy_buffering off;
}
```

Le fichier `server/onchat/ecosystem.config.cjs` prévoit **une seule instance en mode fork**. Les salles WebRTC sont en mémoire : répartir les participants entre plusieurs processus de signalisation isolés empêche leur découverte mutuelle. Ne pas démarrer une deuxième instance concurrente sur le même port.

Après configuration de l'environnement serveur existant, sans copier de secrets dans Git :

```sh
pm2 startOrReload server/onchat/ecosystem.config.cjs
curl --fail http://127.0.0.1:3101/health
```

La santé doit annoncer `service: onchat-websocket`, `protocol: cashpay-shared-realtime-v1` et `status: online`. Elle répond 503 si l'écoute PostgreSQL est indisponible. Configurer `NEXT_PUBLIC_ONCHAT_WS_URL=wss://app.cashpay-all.com/ws` au build web. Mettre à jour ensemble backend, processus WS et clients, puis vérifier deux comptes distincts.

## Audio/vidéo et arrière-plan

Le WebSocket transmet la signalisation ; WebRTC transporte réellement le son et la vidéo. Un relais TURN joignable est nécessaire sur les réseaux où STUN ne suffit pas : utiliser les paramètres existants `NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL` avec des identifiants adaptés et limités. Les droits de parole de l'organisateur restent appliqués.

Le service Android garde la connexion tant qu'Android autorise son exécution. Un WebSocket seul ne peut pas réveiller une application arrêtée de force : ce cas nécessite une configuration de push système (par exemple FCM). Ne pas assimiler compilation et essai réel sur deux téléphones.

Aucune commande de ce document n'a été exécutée en production dans cette mission.
