# Gestion agents — correctif du 4 novembre 2026

## Causes confirmées

Les logs de production montrent PostgreSQL 42P01 pour `subscriptions`. Cette table est utilisée pour les paiements TV/Starlink, leur file de validation et leur remboursement. Une requête sur cette table ne peut pas fonctionner avant installation de son schéma. Les données financières ne doivent pas être remplacées par des demandes de démonstration.

Les interfaces TV/Starlink utilisaient également leurs propres forfaits et montants statiques. Elles lisent maintenant les offres actives de `tv_subscription_fees`, le catalogue déjà utilisé par l’USSD. Le paiement prend le titulaire authentifié, le forfait demandé par ID et le PIN ; le moteur relit le tarif configuré, respecte la devise autorisée et refuse un dépassement du montant confirmé. L’identité et le prix arbitraires transmis par un navigateur ne suffisent plus pour soumettre un paiement. L’ancienne Server Action renvoie explicitement une demande d’actualisation.

L’enregistrement et le débit partagent la même transaction SQL. Les demandes restent `pending` tant que le gestionnaire n’a pas enregistré une référence de confirmation fournisseur. Une clé de demande côté web et un verrou transactionnel évitent un second débit pour une relance identique. L’USSD garde son contrôle PIN et son moteur de paiement existant ; il appelle le règlement interne après validation du forfait en base.

Le traitement TV existant vérifie l’identité gestionnaire, son PIN, sa juridiction, le paiement original et l’état de la demande. Un remboursement utilise la devise et le montant réellement payés, frais compris, puis marque le paiement Reversed et la demande cancelled. Il ne peut pas être exécuté deux fois sur une même demande traitée.

## ENUM et nominations inter

`20261104_inter_agent_role_enum.sql` trouve le type ENUM réel de `users.role`, même si son nom diffère. Il ajoute `InterAgent` et `InterAgentSupervisor` sans supprimer les autres valeurs ni modifier un compte. Il refuse une conversion implicite si la colonne n’est pas un ENUM.

L’ENUM ne constitue pas une nomination. Le contrôle d’accès inter reste fondé sur `inter_agent_memberships`, son activation, son pays, sa province et sa fonction agent/supervisor. Les nominations existantes ne sont pas écrasées et les nouveaux libellés ne confèrent pas de droits de super-agent, de changement de taux ou d’accès national.

## Pages blanches et images

L’entrée de l’espace super-agent utilise une route de session HTTP authentifiée, avec délai et erreur visible, plutôt qu’une Server Action pour amorcer la navigation. Les erreurs d’une page ont un écran Réessayer et une page de chargement. L’accès n’est jamais ouvert en cas d’échec.

Les pièces KYC utilisent des requêtes d’image natives qui conservent le cookie du navigateur. L’optimiseur Next/Image ne transmet pas automatiquement la session pour récupérer une pièce protégée. Un document absent, une URL de placeholder connue ou une image défaillante affiche un état indisponible ; aucune fausse identité n’est produite.

La page `/super-agent/diagnostics` vérifie les colonnes réellement présentes pour comptes, KYC, abonnements, prêts, dossiers inter et journal. Elle affiche aussi les valeurs de l’ENUM présent en base. Elle est réservée aux gestionnaires actifs et ne contient ni soldes, PIN, jetons ou documents privés. Un schéma disponible ne prouve pas qu’un fournisseur ou un mouvement financier a été testé.

## Requêtes Adminer

1. Sélectionner la bonne base et contrôler les schémas existants.
2. Exécuter séparément le script ENUM. Ne pas affecter un nouveau libellé à un utilisateur avant validation de cette requête.
3. Installer le schéma `20261104_service_subscriptions.sql`, qui ajoute également `subscriptions.request_key`. Si une table de même nom existe mais n’a pas le contrat requis, le script échoue et annule ses opérations ; il n’invente pas les paiements historiques.
4. Si nécessaire, appliquer `20261104_tv_catalog_currency_compatibility.sql` au catalogue existant. Les prix restent ceux enregistrés ; les nouvelles valeurs NULL conservent le repli existant.
5. Les migrations inter, prêts et OnChat précédentes sont fournies séparément avec un inventaire. Ne pas confondre abonnements TV `subscriptions`, abonnements d’agents `agent_subscriptions` et abonnements push web `push_subscriptions`.

Aucun SQL n’est exécuté sur la production par ce correctif. Le code et le schéma des abonnements doivent être livrés ensemble.

## Logs Server Action et livraison

`Failed to find Server Action "x"` signifie que l’action demandée n’est pas connue de l’instance qui la reçoit. Des pages ouvertes avant une livraison, des builds différents ou des requêtes non issues de l’interface peuvent produire ce message. Le log seul ne permet pas d’attribuer tous ces appels à une cause unique.

Livrer un build cohérent, éviter de reconstruire `.next` sous un processus qui le sert, redémarrer les instances sur le même artefact et faire recharger les anciens onglets. Aucune modification de variable d’environnement ou de clé de chiffrement n’est effectuée ici. Les logs OTP partagés contiennent des codes ; les sources actuelles `.ts` ne présentent plus la ligne de debug, mais les sauvegardes historiques la contiennent encore : vérifier la révision réellement déployée. Aucun code OTP n’est recopié dans ce rapport.

## Vérifications et portée

Migrations testées deux fois sur PostgreSQL/PGlite isolé, avec un nom d’ENUM différent. Coordination SQL des abonnements testée : débit unique, demande pending, annulation sur échec d’insertion, manque de table et solde insuffisant. Traitement TV testé : PIN/acteur invalides, référence fournisseur obligatoire, remboursement unique et journal. Le moteur de paiement et l’identité sont des doublures dans ces bancs hors Git : aucun argent réel ni fournisseur n’a été utilisé. Les tests ne prouvent pas les parcours de tous les services super-agent.

Les parcours complets de création/validation de compte, les prêts et recouvrements sur de vrais comptes, les services cartes et fournisseurs, ainsi que les notifications push Android, relations et liaison Google demandées précédemment restent à valider ou traiter. Cette livraison ne les présente pas comme terminés. Wallet Best et Wallet-final ne sont pas modifiés. Aucun merge, déploiement, redémarrage de production ou migration exécuté.
