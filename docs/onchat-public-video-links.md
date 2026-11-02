# Correctif des liens publics de vidéos OnChat

La vidéo 14 est disponible via `GET /api/v1/media/videos/14` (HTTP 200), mais son lien partagé `/onchat/videos/14` retourne HTTP 404 sur le site public. La page correspondante est absente de `main` au commit de base `6d7163dec87f6ca914ef3cf5d0bd33a661e32a72`.

Ce correctif ajoute uniquement une page publique de lecture et son composant client. Il est basé sur `main` pour pouvoir livrer la réparation sans fusionner la grande branche des fonctionnalités OnChat/agents.

La page utilise les routes existantes : détail public de la vidéo, likes et commentaires. Le lecteur montre la miniature si elle existe, l’auteur et ses initiales en secours, un indicateur de chargement, les contrôles audio/lecture et le partage du même lien. Le bouton « Ouvrir dans OnChat » conserve le lien profond `onchat://videos/{id}`. Une connexion est requise pour les interactions authentifiées, pas pour regarder une vidéo publique. Une vidéo privée, supprimée ou expirée affiche un message explicite ; aucun contrôle d’accès de l’API n’est contourné. Les opérations attendent la réponse du serveur.

Aucune route API, table, colonne, permission financière, dépendance ou application Android n’est modifiée. Aucun compte ou média fictif n’est ajouté.

## Livraison

Après validation et fusion du correctif, utiliser le processus habituel de livraison du backend : installation des dépendances selon le lockfile existant, compilation Next.js, puis redémarrage contrôlé du service avec le nouveau build. Un simple `git pull` sans reconstruction/redémarrage du serveur Next.js ne suffit pas.

Vérification après livraison : `/onchat/videos/14` doit répondre HTTP 200 avec l’interface OnChat ; l’API doit toujours retourner la vidéo 14 ; la lecture doit être vérifiée dans un navigateur. Aucune migration SQL n’est nécessaire. Cette branche ne déploie rien automatiquement.
