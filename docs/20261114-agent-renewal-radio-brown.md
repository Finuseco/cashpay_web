# Renouvellement Agent, tarifs, choix et palette Web

## Abonnement

Les paramètres lisent maintenant la date de fin réelle : un ancien statut `active` dont la date est passée ne masque plus le renouvellement. L’écran expiré de l’espace Agent propose aussi le formulaire directement, sans dépendre de l’accès aux outils suspendus. Le montant vient du tarif en base, est affiché puis confirmé avec le PIN ; un tarif modifié avant validation est refusé. L’essai est réservé à la première activation. Une nouvelle activation n’active plus automatiquement le consentement au renouvellement.

Le titulaire peut activer/désactiver `auto_renew` sur son propre compte. L’action refuse un autre utilisateur. L’option reste accessible après expiration, et le renouvellement manuel reste disponible si le mode automatique est désactivé ou si une tentative a échoué. Le choix existant est conservé lors d’un renouvellement manuel.

Le nouveau traitement interne `/api/internal/jobs/agent-renewals` utilise le secret interne existant. Seuls les comptes actifs et abonnements échus autorisés sont traités. Première tentative à l’expiration, puis nouvelle tentative au plus tôt 48 heures après chaque échec, même si la date de fin est ancienne. Le worker vérifie chaque minute ; un signal de dépôt existant peut réveiller la vérification, mais ne raccourcit pas les 48 heures. Le tarif standard du pays est relu pour chaque tentative.

Un débit réussi ouvre 30 jours à partir du paiement, sans facturer les mois d’inactivité. Les verrous utilisateur/abonnement sérialisent le renouvellement manuel et automatique. Les échecs ne créent pas de découvert ni de transaction financière validée ; savepoint, notification et journal conservent la tentative. Les écritures d’audit `AGENT_RENEW_*` sont réservées au service, pas à l’ancienne action générique d’intervention. L’audit existant enregistre aussi les succès. Aucun nouveau schéma SQL n’est ajouté.

Après mise à jour, compilation et redémarrage de CashPay Web :

```bash
cd /var/www/cashpay-all/wallet &&
npm run agents:enable
```

Cette commande configure seulement `cashpay-agent-renewals` dans PM2 et vérifie un passage réussi. `npm run agents:status` permet le contrôle ultérieur. Elle ne change aucun fichier d’environnement et ne redémarre pas les autres applications. Un build seul ne démarre pas ce worker. Les prélèvements déjà éligibles peuvent commencer dès son activation.

## Affichage

Les pages de services utilisent des choix radio en ligne, avec recherche, défilement borné et états désactivés, sans Select, liste native ou portail de sélection. Les groupes conservent les valeurs contrôlées, les changements React Hook Form et le nom du champ lorsqu’il existe. Le sélecteur de langue est une boîte de dialogue à radios. Les commandes de consultation, modification et suppression restent des boutons dans des panneaux dépliables : elles ne deviennent pas des choix radio destructifs. Les contrôles de connexion et inscription sont exclus de la migration de sélecteurs ; leurs composants historiques restent disponibles dans la bibliothèque.

Le catalogue TV client utilise les mêmes radios avec fournisseur, forfait, prix et devise. Le paiement conserve sa confirmation de prix, son PIN et sa clé de reprise.

La grille des frais garde les derniers tarifs pendant une actualisation et en cas d’échec, propose l’actualisation explicite et au retour sur la fenêtre, et ignore les réponses périmées. Le layout ne réinitialise plus son écran de chargement lorsque la session est déjà acquise. Les anciens paliers simples `flat` ou `percent` sont normalisés comme les valeurs actuelles `fee` dans l’affichage et dans le calcul ; un taux absent ou malformé n’est pas remplacé par un taux inventé.

La palette marron est partagée par les variables claires/sombres, les surfaces de marque du dashboard, les entêtes, le profil complet et les variables OnChat. Les couleurs sémantiques succès/erreur restent reconnaissables. Les logos, médias et dispositions de formulaires sont conservés.

## Vérifications

- Vrai SQL et moteur de transaction sur base isolée : anciennes expirations, premier échec sans solde, limite 48 heures, reprise après dépôt, aucun doublon ni découvert, période de 30 jours après réussite ; abonnements futurs/non automatiques inchangés.
- Actions manuelles : PIN incorrect et prix changé refusés ; statut expiré correctement exposé ; renouvellement manuel réussi sans activer le mode automatique ; refus d’accéder/modifier le compte d’un autre titulaire.
- Paliers anciens : mêmes valeurs dans le calcul et la grille des frais.
- Worker et CLI exécutés avec PG/HTTP/PM2 interceptés : passage au démarrage/minute, signal de crédit, secret, endpoint fixe, état de santé et arrêt propre, pas de DDL.
- Composants réels en navigateur à 360 et 1440 px avec API interceptée : renouvellement manuel et consentement, option automatique, paiement TV par radio, choix recherchables/clavier/désactivés, actualisation des frais sans boucle ni perte des derniers tarifs, boutons d’actions sans menu flottant, absence de débordement et d’erreur JavaScript.
- Régressions isolées USSD, entreprise/paie et recouvrement LoanMe ; compilation Next de production. Le contrôle TypeScript global conserve les erreurs anciennes du dépôt ; les nouveaux modules sont contrôlés séparément.

Aucune opération financière réelle, notification externe ou modification de production n’a été exécutée pendant ces vérifications.
