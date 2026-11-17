# Candidatures vers les boîtes mail — sans dossiers conservés sur le serveur

La route publique est `POST https://app.cashpay-all.com/api/careers` dans le processus Next.js existant de CashPay Web.
Main lui transmet son formulaire multipart directement, sans cookie ni clé secrète dans le navigateur.
Les origines de Main autorisées sont `https://cashpay-all.com` et `https://www.cashpay-all.com`.

## Traitement

Les champs, le CV, la photo et les documents sont contrôlés et transmis en mémoire. Aucun dossier n'est écrit en base ou sur disque.
Il n'y a pas de file persistante, de renvoi automatique ni de liste de candidatures alimentée dans l'administration.
La boîte `info@cashpay-all.com` et sa redirection configurée chez le fournisseur conservent les messages.

Le message interne est envoyé avec les autorisations d'envoi déjà configurées dans Next.js. Son destinataire est fixé côté serveur.
Le candidat apparaît en adresse de réponse ; le serveur ne se fait pas passer pour son fournisseur mail.
Après acceptation du message interne, un accusé est tenté séparément avec l'expéditeur `noreply@` configuré.
Un échec de l'accusé ne transforme pas une candidature déjà transmise en échec de soumission.
Le mot de passe d'`info@` n'est jamais requis pour lui adresser un message ; les accès SMTP concernent uniquement le transport expéditeur.

Le résultat distingue l'acceptation SMTP du message interne et celle de l'accusé. L'acceptation SMTP ne prouve pas la remise finale ni la redirection.
Un refus SMTP renvoie une erreur et le formulaire conserve les fichiers sélectionnés. En cas de rupture réseau après l'envoi, la réception peut être incertaine.

## nginx sur app.cashpay-all.com

Ajouter cette règle uniquement dans le vhost existant de `app.cashpay-all.com`, en adaptant le port au processus Next actif.
Le script `start` du dépôt utilise actuellement le port 8002.

```nginx
location = /api/careers {
    client_max_body_size 22m;
    proxy_pass http://127.0.0.1:8002;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 90s;
}
```

`proxy_request_buffering off` et HTTP/1.1 sont nécessaires pour éviter que nginx écrive les fichiers multipart dans ses fichiers temporaires,
y compris pour une requête en transfert chunked. Appliquer la même exigence à tout proxy supplémentaire placé devant cette route.
Ne pas journaliser le corps des requêtes ou les pièces jointes. Si nginx produit lui-même une erreur (taille dépassée ou indisponibilité),
le navigateur peut la présenter comme une erreur réseau faute d'en-têtes CORS : le formulaire reste disponible.
Si une CSP est définie pour Main, autoriser `https://app.cashpay-all.com` dans `connect-src`.

Sur le vhost de Main, retirer l'ancienne règle qui envoyait `/api/careers` au service local et la remplacer par :

```nginx
location ^~ /api/careers {
    return 410;
}
```

Le nouveau formulaire appelle directement le sous-domaine app. Cette réponse immédiate empêche les anciens formulaires en cache
de déposer encore des pièces via l'ancien proxy de Main. Ne pas conserver deux règles concurrentes pour ce même préfixe.

Vérifier `nginx -t` avant de recharger nginx. Les autres routes et les autres vhosts gardent leur configuration.

## Bascule

1. Intégrer les fichiers de cette route au dépôt CashPay Web, installer les dépendances habituelles et construire l'application.
2. Déployer la route dans le processus Next existant ; aucun serveur Carrières supplémentaire n'est requis.
3. Appliquer la règle nginx et vérifier la réponse OPTIONS depuis le domaine Main.
4. Mettre à jour Main pour utiliser l'URL absolue de l'API et son nouveau message de résultat.
5. Retirer la règle proxy Carrières de Main selon l'exemple ci-dessus, arrêter uniquement l'ancien processus `cashpay-careers`, puis sauvegarder la liste PM2.

Les anciens dossiers ne sont pas importés ni rejoués. Cette modification ne les supprime pas.
Les routes internes d'administration et le service d'e-mail partagé existants ne sont pas modifiés.

Les tests du module utilisent des transports simulés et n'envoient aucun message réel.
Avant de déclarer la livraison opérationnelle, vérifier une soumission autorisée depuis le processus Next de production et sa réception dans la boîte finale.

## Variables propres à la route

Dans l'environnement du processus Next.js, définir `CAREERS_TRUST_PROXY=1` lorsque le vhost nginx ci-dessus est en place.
Cela permet d'appliquer la limite de six soumissions par heure à l'adresse transmise par ce proxy.
Sans cette option, la route utilise par prudence une seule limite partagée de six soumissions par heure.
L'amont Next doit être accessible uniquement via le proxy de confiance, qui écrase `X-Forwarded-For` au lieu de transmettre une valeur fournie par le client.
Si un CDN est présent, configurer d'abord les adresses de proxy de confiance et l'adresse réelle dans nginx.

`CAREERS_MAIL_TO` permet de choisir le destinataire côté serveur ; sa valeur par défaut est `info@cashpay-all.com`.
`CAREERS_MAIL_FROM` permet de choisir un expéditeur autorisé ; sinon la route reprend `MAIL_FROM` ou `SMTP_USER`.
L'envoi réutilise `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` et `SMTP_PASSWORD` (ou `SMTP_PASS`) déjà chargés par Next.js.
L'accusé reprend `MAIL_NOREPLY` ou le compte d'envoi. Pour un compte d'accusé distinct, les variables facultatives
`NOREPLY_SMTP_HOST`, `NOREPLY_SMTP_PORT`, `NOREPLY_SMTP_USER`, `NOREPLY_SMTP_PASSWORD`/`NOREPLY_SMTP_PASS` sont prises en charge.
Ces variables restent côté serveur ; aucune configuration de mot de passe du destinataire n'est nécessaire.

Le catalogue pays/provinces/postes provient de `js/jobs-data.json` de Main et est livré dans `src/lib/careers/jobs-data.json`.
Lors d'une modification de ces listes, mettre à jour les deux copies ensemble.
