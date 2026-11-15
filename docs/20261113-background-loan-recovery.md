# Recouvrement sans ouverture de LoanMe

L’ouverture du composant Web LoanMe appelait directement le moteur de recouvrement. Ce déclencheur de lecture est retiré : les prélèvements doivent être exécutés par le worker PM2, indépendamment des écrans ou des connexions utilisateur.

Le worker écoute le signal PostgreSQL émis après la validation d’un crédit dans `wallets.balances`. Il traite maintenant le titulaire concerné via la route interne authentifiée `?userId=...`, au lieu de relancer tous les dossiers pour chaque dépôt. Les signaux reçus pendant un traitement sont regroupés, sans exécutions HTTP simultanées dans ce worker. Un balayage au démarrage et chaque minute reprend les dettes existantes, les échéances devenues exigibles sans dépôt et les signaux perdus. La file est conservée en cas d’échec ; le nettoyage ne supprime pas les nouveaux crédits arrivés pendant le passage.

Le moteur financier garde ses transactions/verrous, la grâce contractuelle de sept jours, les frais, la devise et les contrôles de cohérence d’échéancier. Il ne prélève pas une dette non exigible. Le trigger ne débite rien : il signale seulement un crédit confirmé.

## Activer sur le serveur

Après récupération de cette branche, compilation et redémarrage du wallet, exécuter depuis `/var/www/cashpay-all/wallet` :

```sh
npm run loans:enable
```

Cette commande charge la configuration de production avec la même priorité que Next, sans afficher ni modifier les fichiers d’environnement. Elle vérifie la présence de la route interne déployée, applique les deux migrations existantes d’échéancier/file, vérifie que le trigger de dépôt est activé, démarre/recharge seulement `cashpay-loan-repayments` et sauvegarde PM2. Le premier passage peut recouvrer des dettes déjà exigibles. Les permissions de migration restent celles du compte PostgreSQL configuré ; en cas de refus, les scripts doivent être appliqués avec le propriétaire autorisé.

La commande attend un passage réussi récent et échoue explicitement si le worker n’est pas confirmé. Le worker publie son dernier résultat dans le nom de sa connexion PostgreSQL (`application_name`), sans nouvelle table métier. La présence de la table seule ou l’état « online » de PM2 ne sont plus utilisés comme preuve de recouvrement opérationnel. Une absence de trigger est signalée même si la file existe.

Pour vérifier ensuite :

```sh
npm run loans:status
pm2 logs cashpay-loan-repayments --lines 40 --nostream
```

Un worker connecté ne prouve pas que chaque dette est recouvrable : un échéancier incohérent, des fonds insuffisants ou une erreur financière sont toujours refusés et doivent être rapprochés. Le statut affiche un passage réussi, pas la promesse qu’un client précis a été débité. Aucun déploiement ou prélèvement de production n’a été effectué pendant le développement.

## Vérifications

Moteur/SQL sur PostgreSQL isolé : ancienne dette, grâce, pénalités, frais, devise, échec transactionnel, doublons, dépôts et file. Vérification de refus d’un trigger désactivé. Route interne ciblée : identifiant invalide refusé, remboursement après dépôt sans session navigateur, reprise sans double débit et nettoyage de file. Worker réel avec transports/horloges isolés : démarrage, minute, signal de dépôt ciblé, messages invalides ignorés, regroupement et arrêt propre. Les scénarios restent hors Git.

## Redémarrage du wallet et contrôle d’activation

Le contrôle attend désormais le démarrage HTTP après `pm2 restart` : jusqu’à quinze tentatives, avec délais bornés, sur les erreurs de connexion et les réponses 502/503/504. Une réponse 401 sans secret confirme la présence du point d’entrée protégé ; elle ne déclenche aucun prélèvement. Un 404 ou une réponse inattendue reste une erreur de déploiement, sans installation ni redémarrage du worker.

Les échecs indiquent leur étape (application, base, migration, trigger, PM2 ou vérification du worker), le statut HTTP ou le code réseau quand ils sont disponibles. Aucun corps HTTP, mot de passe, URL confidentielle ou secret interne n’est affiché. Le précédent `SETUP_FAILED` après un redémarrage ne permettait pas de distinguer un serveur encore en cours de démarrage d’une autre panne.
