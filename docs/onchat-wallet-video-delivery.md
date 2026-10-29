# OnChat — USDT/BTC, statuts et montage vidéo (29 octobre 2026)

## Contrats conservés

Les transferts restent exécutés par `/api/v1/transfers` avec PIN. Le contrat d’exécution partagé avec Cash Pay All n’a pas été modifié. Les transferts fiat dans le chat réutilisent la route de conversation existante, avec destinataire déduit côté serveur ; seul l’import du calculateur de frais de son aperçu, incorrect auparavant, a été corrigé. Le contrat existant utilise `USDT` pour envoyer, `USDT_TRC20` pour le registre et exige une adresse TRON ; BTC exige une adresse Bitcoin. Le serveur refuse les aperçus crypto sur cette route : OnChat utilise désormais un devis séparé, sans opération financière, lié aux deux membres de la conversation.

Les réponses crypto réelles contiennent `status: Completed`, `referenceCode`, `fee`, `totalDebited`, sans forcément de propriété `transaction`. Android les prend en charge, sans fabriquer une référence. Le reçu du chat est créé depuis une transaction réelle du registre et sa synchronisation peut être reprise sans recommencer le paiement.

## Backend livré

- `/api/onchat/conversations/[conversationId]/crypto-quote` : authentification, appartenance, adresse canonique du correspondant, solde du registre et frais `WD_CRYPTO_MONEY` existants.
- `/api/onchat/conversations/[conversationId]/transfer-receipt` : reçu idempotent, vérifié par expéditeur/destinataire/référence/statut, notification WebSocket après validation.
- Lecture des statuts par numéros authentifiée et limitée à 500 numéros ; dates d’expiration, vues et mentions J’aime réelles. Les numéros suivent le contrat existant des neuf derniers chiffres.
- Les deux chemins de publication vidéo vérifient la durée du conteneur et la présence d’une piste vidéo : maximum 600 secondes et 200 Mo. MP4/MOV classiques sont vérifiés sans dépendance supplémentaire ; les autres conteneurs requièrent `ffprobe` (`FFPROBE_PATH` facultatif).
- Nettoyage des fichiers de publication en cas d’échec, noms de fichiers dérivés du MIME autorisé.
- Jimmy : `/api/onchat/media/editor`, appel Genkit réel, paramètres d’effets validés et transcription audio horodatée. Sans configuration IA, réponse d’erreur explicite ; aucun texte simulé.
- Sons : permission explicite, attribution à l’auteur original, vérification avant réutilisation. Le crédit est conservé lorsque la source est supprimée ; une source indisponible ne peut plus être réutilisée.
- Le flux renvoie noms/avatars/abonnements des diffuseurs. La route manquante `/api/v1/social/action` prend en charge follow/unfollow sur la table `user_followers` déjà utilisée par les profils. Les autres actions sociales non implémentées sont refusées.

## Android livré

Carte USDT TRC20 avec solde/adresse provenant du wallet ; devis BTC/USDT réels ; reçus de paiement synchronisés ; données de statut limitées au compte et aux numéros locaux, dates ISO correctement lues et anciennes entrées remplacées après une synchronisation réussie.

Capture CameraX réelle avec caméra/micro et durée réglable, en remplacement du fichier vidéo vide. Tous les chemins de publication passent par le même éditeur : découpe, vitesse, photos successives, durée des photos, filtres, textes, voix/musique séparées, aperçu MP4 rendu, export vertical 720p/1080p avec débit limité. Jimmy propose les réglages appliqués par le moteur local et génère des sous-titres synchronisés depuis l’audio sélectionné. L’upload lit le fichier progressivement et affiche le pourcentage des octets envoyés ; la réussite attend la confirmation du serveur.

La lecture des Shorts est limitée à la page active et s’arrête en arrière-plan. Pagination, onglet des abonnements, réactions et abonnements utilisent les réponses serveur. La réutilisation d’un son charge la piste de la source autorisée et conserve nom/avatar/lien de son auteur. Le faux message de recharge financière a été retiré : les dépôts crypto copient l’adresse réelle et les recharges fiat ouvrent le parcours CashPay existant.

## Déploiement et limites

Appliquer la migration additive `migrations/20261029_onchat_video_sounds.sql` à la base cible pour activer le catalogue et la permission de réutilisation des sons. Aucun compte ni solde n’est modifié par cette migration. Les anciennes applications qui n’envoient pas de paramètres de son conservent leur contrat de publication. Aucune migration n’a été exécutée sur la production depuis cet environnement.

Jimmy nécessite `GEMINI_API_KEY` sur le serveur et accepte `ONCHAT_EDITOR_MODEL` (défaut `googleai/gemini-2.5-flash`). Les sous-titres IA doivent être relus. L’attestation de droits et le crédit ne remplacent pas une vérification juridique des licences de musique.

Aucun transfert monétaire réel, test caméra sur téléphone, export GPU sur appareil ou appel IA payant n’a été exécuté avec des comptes de production. Les validations de compilation ne constituent pas une validation bout en bout de ces parcours. Aucun fichier de test, mock, compte fictif ou secret n’est ajouté aux dépôts. Résultats finaux des compilations et commits communiqués à la livraison.

## Vérifications de livraison

Compilations Android `assembleDebug` et `assembleRelease` réussies avec JDK 17, Android SDK 35 et Gradle 8.9. La variante release est non signée : aucune clé de publication de production n’a été ajoutée. Build Next.js de production réussi ; vérification TypeScript ciblée sur les fichiers modifiés : zéro diagnostic. Le contrôle de durée sur des MP4 locaux a accepté une seconde et rejeté 601 secondes. Le projet web conserve ses problèmes de typage/lint globaux préexistants et sa configuration de build qui ignore ces contrôles ; le résultat ciblé ne les efface pas.
