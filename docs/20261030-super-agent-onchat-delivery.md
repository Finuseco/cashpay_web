# Super agents et fiabilité OnChat — 30 octobre 2026

Cette livraison est du code applicatif. Aucun accès au serveur de production, aucune migration, aucun paiement, aucune émission de carte et aucun message externe n'ont été exécutés.

## Corrections

- Les actions de gestion vérifient la session réelle, le pays, la province et la hiérarchie. Un sous-super agent ne peut ni administrer ses supérieurs ni modifier les taux.
- Tableau régional : utilisateurs, comptes actifs/bloqués, agents, soldes séparés par devise, volumes et frais facturés du mois, commandes/cartes/TV/réclamations/chèques, dernières transactions. Les sources indisponibles sont identifiées. Les avoirs clients et frais facturés ne sont pas présentés comme un bénéfice net.
- Enregistrement des taux avec PIN dans un dialogue, contrôles serveur et relecture après sauvegarde.
- Frais clients : export manquant réparé, grilles effectives locales/globales, fin du chargement après erreur, bouton de relance. Le chargement global ne dépend plus du fournisseur de cartes sur chaque page.
- Recherche par téléphone normalisé, pagination et protection contre les réponses de recherche obsolètes. Les secrets de compte sont retirés des résultats.
- Suspension : motif obligatoire et présenté après authentification valide ; une session existante d'un compte suspendu est refusée.
- Abonnements TV : activation administrative seulement après paiement confirmé et référence fournisseur. Rejet avec remboursement du paiement original, verrouillage, invalidation de l'original et audit dans la même transaction.
- Modération produits/événements/liens et renouvellement agent : autorisations territoriales, état relu, conservation du rang administratif, renouvellement actif non redébité.
- Notifications de dépôt : un échec de notification après validation financière n'annonce plus un échec du dépôt.
- Cartes : suppression de la fabrication d'une carte virtuelle aléatoire et de la livraison non vérifiée. Les demandes physiques locales restent disponibles ; les remboursements des nouvelles demandes sont liés au débit original. Les anciennes demandes sans rapprochement nécessitent une vérification comptable.
- Webhooks historiques : signature obligatoire avec secret distinct `MARQETA_WEBHOOK_SECRET`, limitation USD/EUR, carte et compte actifs, exclusion des cartes FYATU v3 préfinancées, protection contre les rejouements JIT par identifiant.
- Communication : comptabilisation des envois acceptés par les fournisseurs ; absence SMTP signalée comme échec, sans journaliser les contenus ou PIN. Le modèle WhatsApp OTP utilise les variables de nom/langue de modèle approuvé et échoue explicitement si absent.
- Suppression des traces OTP dans les deux modules d'authentification exécutés.
- Publication vidéo : génération de miniature réelle depuis le fichier local avec ffmpeg ; échec d'extraction signalé dans les logs sans miniature fictive.
- Migration additive dédiée aux erreurs de réunions observées : colonnes des participants sur une table préexistante, groupe et compatibilité `host_id`/`host_user_id`.

## Vérifications

- `npm run build` : compilation de production vérifiée. La configuration existante ignore les types/lint ; cela ne les valide pas.
- Contrôle TypeScript ciblé sur les fichiers modifiés : aucun diagnostic. Trois fichiers présentant déjà des erreurs de syntaxe hors périmètre sont isolés uniquement dans le processus de vérification, sans modification du dépôt.
- Vérification temporaire hors dépôt : signatures valides/refus des signatures manquantes ou altérées ; extraction réelle d'une miniature ffmpeg et traitement d'un fichier inexistant.
- `git diff --check`.
- Aucun nouveau test, jeu de données ou secret livré.

## Déploiement et limites

1. Appliquer délibérément les migrations OnChat manquantes depuis Adminer, dont `20261030_onchat_meeting_schema_compatibility.sql`. Vérifier le schéma réel avant exécution ; aucune migration n'est lancée automatiquement.
2. ffmpeg doit être disponible (`FFMPEG_PATH` optionnel). Les miniatures des anciennes publications ne sont pas recréées automatiquement.
3. Les webhooks Marqeta historiques ne sont pas une intégration de financement FYATU v3. Ne pas les configurer comme callbacks FYATU ni doubler le débit des cartes préfinancées. Aucun nouveau contrat fournisseur n'est inventé.
4. Les parcours réels avec comptes, base PostgreSQL, fournisseurs et téléphones restent à valider. L'environnement de compilation n'a pas de base de production ni de comptes de test.
5. La refonte complète des créations de comptes, validation KYC, rémunérations nettes, compensation et émission physique FYATU n'est pas livrée comme opérationnelle. Les commandes qui produisaient des faux succès sont refusées explicitement.
6. Les erreurs préexistantes d'exports d'autres modules signalées par Next.js restent visibles dans le build. Le build n'est pas une validation financière de bout en bout.

## Complément authentification après lecture des logs

- Les routes historiques de connexion/inscription ne renvoient plus un identifiant utilisateur fictif ou un envoi simulé. Les transports SMS/email sont réellement appelés et un refus fournisseur échoue explicitement.
- Les OTP ne sont plus exposés comme « code de secours » en réponse serveur ni montrés à l’agent après un échec d’envoi. Génération cryptographique ; un email refusé ne vaut plus confirmation.
- Le transfert assisté lie son OTP à l’agent, aux deux comptes, au montant et à la devise. Validation et mouvements financiers partagent la transaction PostgreSQL ; il ne crée pas une session client pendant la confirmation de l’agent.
- Le code fixe de validation d’achat de crédit est remplacé par la consommation du code enregistré, non expiré et non utilisé ; la juridiction de l’agent est vérifiée.
- La route historique de changement de PIN vérifie la session, l’ancien hash et met à jour le compte réel ; l’export cassé de la route v1 est corrigé.
- La clé API publique codée en dur de l’ancienne route `/api/auth/initiate-login` est supprimée : configurer `CASHPAY_CLIENT_API_KEY` pour les clients qui utilisent cette route. Aucun secret n’est fourni dans le dépôt.

Ces validations financières nécessitent encore une recette avec des comptes et fournisseurs autorisés. Cela ne certifie pas les autres anciens services financiers ou jeux comme exempts de simulations. Aucun paiement n’a été exécuté pour les vérifier.
