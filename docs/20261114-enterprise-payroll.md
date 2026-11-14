# Compte entreprise et paie — schéma existant

Le programme réutilise `users.account_type = business` et remplace `full_name` par la raison sociale. Le rôle, le Wallet ID, le PIN, la connexion et les champs d’identité du gérant restent ceux du compte existant. Il ne donne pas automatiquement de rôle PartnerB2B ni de clés API. Après la création habituelle d’un compte client, un administrateur ou super-agent habilité peut activer ce mode sur sa fiche. Le périmètre pays/province et le PIN professionnel sont vérifiés.

Aucune table, colonne, fonction SQL ni valeur ENUM n’est ajoutée. Les paramètres, habilitations, salariés, avances, décisions, paies et factures sont des événements structurés `ENTERPRISE_*` dans le journal existant `super_agent_interventions`. Le moteur de paiement utilise les tables existantes `wallets`, `transactions` et `notifications`. Les coordonnées des salariés et leurs rémunérations ne sont pas placées dans le profil public de l’utilisateur. Les écritures directes de ces événements par l’ancienne action générique d’intervention sont interdites.

## Forfait et exonération

Dans la gestion des frais Admin, créer `ENTERPRISE_MONTHLY`, pour le pays ou GBL et la devise du forfait. Il faut un montant fixe positif, avec un seul palier minimum 0 / maximum 0. Aucun prix n’est supposé. L’activation affiche le prix et demande sa confirmation ; si le tarif change avant validation, l’activation est refusée.

Tous les frais CashPay calculés par le moteur Web pour le titulaire habilité sont exonérés ; les devis et les paiements utilisent l’identité du payeur relue en base. Les prix des biens/services, montants transférés, dettes et taxes de vente `PRODUCT_SALE_VAT` restent dus. Les commissions versées à des tiers ne sont pas supprimées comme s’il s’agissait de frais facturés à l’entreprise. Les clients ordinaires, les comptes `business` sans activation et les salariés à titre personnel gardent leurs tarifs habituels.

Le forfait est dû le dernier jour du mois à 23 h 59, selon l’heure de la base, et est rattrapé après une interruption. Le mois d’activation est facturé en entier, sans prorata. Une facture insuffisamment provisionnée est enregistrée en attente, sans découvert ; son montant reste figé même si le tarif évolue ensuite. Les nouvelles opérations exonérées et la paie sont bloquées tant que des forfaits échus sont impayés. Le recouvrement des prêts conserve ses autorisations propres.

## Gestion et paiement

L’espace `/enterprise` est réservé au titulaire et aux personnes effectivement habilitées. Il permet de consigner des comptes CashPay personnels existants, un salaire mensuel, une devise et un mois d’entrée. Le gérant peut déléguer à un autre gérant, un trésorier, un comptable ou un caissier. Le gérant principal désigné à l’activation ne peut être remplacé par une simple révocation de collaborateur : cela nécessite une intervention administrative.

Le comptable/caissier peut enregistrer une avance déjà versée ou une dette documentée. Cet enregistrement ne verse pas d’argent. Seul le gérant peut valider une retenue, la mettre en litige ou la rejeter. Une retenue en attente ou en litige bloque le salarié concerné. Une retenue partiellement consommée est reportée, et ne peut plus être réécrite rétroactivement.

La paie porte sur au plus 200 salariés et 12 mois échus ou en cours par lot, dans une même devise, sans conversion implicite. Les cases à cocher demandent un devis serveur indiquant brut, retenues validées, net et solde suffisant/insuffisant. Le gérant ou le trésorier confirme avec son propre PIN. Une nouvelle version du devis nécessite une nouvelle confirmation.

Le lot verrouille les portefeuilles et réévalue le montant total avant tout versement. Les règlements entreprise utilisent PostgreSQL NUMERIC pour les débits/crédits, afin que 0,10 + 0,20 puisse être payé intégralement depuis 0,30 sans erreur binaire. Toutes les écritures financières, imputations de retenues, notifications et journaux appartiennent à la même transaction : le lot entier est validé ou annulé. Une clé de reprise protège les tentatives répétées ; un salarié/mois déjà réglé ne peut pas être payé une seconde fois, même avec une autre clé.

Les alertes dans l’application incluent le nom de l’entreprise, les mois, le brut, la retenue, le net et la référence. Les canaux e-mail/SMS/WhatsApp configurés pour le destinataire sont sollicités après commit, sans annoncer une livraison externe garantie. L’Admin utilise sa file d’envoi existante si disponible ; sinon il conserve la notification en base et sollicite le SMTP existant, sans exiger la création d’une table de messagerie.

## Activation du traitement mensuel

Après compilation et redémarrage de CashPay Web :

```sh
npm run enterprise:enable
```

Cela active seulement `cashpay-enterprise-billing` dans PM2 et confirme un passage réussi, sans migration. Le worker vérifie les forfaits chaque minute et réutilise, lorsqu’il est présent, le signal de crédit déjà installé pour LoanMe ; aucune navigation utilisateur n’est requise. Le premier passage peut prélever des forfaits déjà échus. `npm run enterprise:status` vérifie ensuite son état. Le back-office Admin doit également être mis à jour pour afficher le formulaire d’activation ; aucun nouveau secret d’environnement n’est requis.

## Validation

SQL et vrai moteur de transaction sur base isolée : activation bornée à la juridiction sans élévation de rôle, pas d’exonération par simple type business, exonération et taxe conservée, gérant/délégations/révocation, retenues et litiges, solde insuffisant sans paiement partiel, rollback d’un échec au milieu du lot, reprises et unicité salarié/mois, paie de plusieurs mois, montants exacts au centime et forfaits échus/repris sans doublon. Aucun argent réel, fournisseur de production ou notification réelle n’a été utilisé dans ces scénarios. Les vérifications temporaires restent hors Git.

Contrôles complémentaires : activation Admin compatible relue par le Web, devis périmé après modification du salaire, report d’une retenue partielle, protection du gérant principal, reprise après réponse perdue ; worker réel et commande d’activation exécutés avec HTTP/PG/PM2 interceptés, sans DDL ; écrans réels à 360 et 1440 px avec API de test, et formulaire Admin avec CSRF/PIN. Les parcours existants USSD, retrait/recouvrement agent et remboursement automatique ont également passé leurs scénarios isolés.

La compilation Next de production passe et le contrôle JavaScript Admin passe. Le dépôt Web conserve des avertissements préexistants d’imports et d’accès à des ressources externes pendant le build ; son contrôle TypeScript global n’est pas propre (anciens fichiers syntaxiquement invalides et anciens contrats de composants). Aucun diagnostic dans les nouveaux modules entreprise lors du contrôle ciblé après exclusion des anciens fichiers invalides. Ces limites ne constituent pas une validation en production.
