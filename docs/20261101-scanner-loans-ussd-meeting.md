# Scanner, crédits, USSD et mails Meet — 1 novembre 2026

## Contrat scanner

`POST /api/v1/scanpay/scan` reçoit `{value}` et renvoie un wallet vérifié, une liste `PRODUCTS` ou un scan de vente/demande. Un code-barres commun à plusieurs boutiques renvoie les choix : aucun premier prix arbitraire. Les codes UPC/EAN équivalents sont recherchés avec leurs zéros de préfixe, sans perdre la référence originale. Le QR produit utilise `{type:"PRODUCT",productId}`. Une vente POS doit contenir les identifiants d’articles et quantités ; le QR web de caisse les inclut désormais. Les anciens QR POS sans articles doivent être régénérés.

Pour préparer : même route avec `{action:"quote",scan,paymentCurrency}`. Le serveur charge prix, promotions, vendeur et stock depuis le catalogue existant (prix USD dans ce schéma), puis calcule conversion et frais. Une demande de paiement QR contient un montant déclaré ; son destinataire est vérifié mais elle n’est pas présentée comme un prix catalogue.

`POST /api/v1/scanpay/payment` reçoit `{quoteToken,pin}`. Le devis HMAC, lié au compte et limité à cinq minutes, est revérifié au paiement : prix, frais, conversion, solde et stock. Le ledger et les stocks changent dans la même transaction. L’identifiant de devis, conservé dans les métadonnées du ledger, empêche le double débit ; un devis déjà réglé restitue le reçu même après expiration. Le jeton a deux segments et un contexte distinct : ce n’est pas une session JWT. Aucun nouveau secret n’est demandé ; JWT_SECRET existant est utilisé avec une séparation de domaine cryptographique.

Les anciens endpoints qui renvoyaient seulement les valeurs reçues ont été raccordés au traitement réel. Les entrées de paiement exigent maintenant un devis ; adapter les clients avant déploiement. Le traitement POS web historique vérifie aussi les articles/prix et refuse les références de vente déjà réglées. Les liens de paiement/tickets non pris en charge par ce nouveau parcours ne sont pas présentés comme des produits validés.

## Crédits et remboursements

Le taux proposé vient de loan_interest_rates, déjà utilisée par le web, et non du dernier prêt ou d’un taux d’interface. `GET /api/v1/loans/offer?currency=EUR&amount=100&durationMonths=6` renvoie le contrat : intérêt forfaitaire, total, garantie, fréquence, échéances et exemple de pénalité selon le tarif configuré. `POST /api/v1/loans/request` exige acceptTerms et acceptedTerms ; les conditions sont revérifiées avant enregistrement. Les demandes concurrentes d’un même wallet sont sérialisées.

`GET /api/v1/loans/repay?loanId=...&amount=...` (ou installmentId) fournit un devis signé avec devise du prêt, frais, total débité et reste. Les POST repay / repay-installment acceptent cet objet dans acceptedPayment. Sa reprise est idempotente grâce au ledger. Les anciens flux web sans devis restent soumis à leur authentification et aux contrôles du moteur ; le nouveau mobile passe par une confirmation explicite.

Les requêtes financières ne mélangent plus `l.*`, `li.*` et `u.*` : le montant, l’identifiant et l’état d’une échéance ne peuvent plus être remplacés par ceux du prêt/utilisateur. Le prélèvement automatique utilise explicitement u_id comme titulaire. L’approbation vérifie la juridiction du gestionnaire et verrouille le prêt avant crédit, pour empêcher une seconde approbation concurrente. Les mutations directes vérifient la session ; le contexte interne des chemins USSD/cron n’est pas sérialisable depuis HTTP. Le job global conserve sa protection INTERNAL_JOB_SECRET. L’ouverture LoanMe en USSD ne déclenche que le traitement du titulaire, conserve la devise du prêt et utilise le même calcul forfaitaire/fréquence.

Les créations/ALTER d’échéancier pendant les opérations de remboursement et les reconstructions à la lecture ont été retirés. Un ancien prêt sans échéancier est bloqué pour rapprochement, sans fabrication d’échéances ni réécriture de dette. L’historique ne recompte plus les pénalités lors de la reconstruction des affectations. Les endpoints historiques de prêts simulés sont remplacés par les contrats authentifiés ; la liste administrative des prêts exige une juridiction et renvoie les mesures réelles, sans score de risque fabriqué.

## OnChat backend : mails de réunion

Le modèle meeting.html présente sujet, auteur, type, état au moment de l’envoi, dates UTC prévues et effectives et bouton adapté. Les liens de messages viennent du domaine configuré ; sujets/noms sont échappés. Les invitations individuelles et de groupe utilisent ce modèle. Une première admission de l’hôte enregistre started_at et notifie les destinataires identifiables dans les participants, invitations et messages (limite de 200). Une reconnexion n’envoie pas un nouveau démarrage. Les fins contrôlées enregistrent ended_at. Les anciennes dates manquantes restent inconnues, sans assimilation à created_at.

L’API status conserve status pour compatibilité et ajoute phase/endedAt ; startedAt correspond au démarrage réel. Un email ne peut pas se mettre à jour après réception : le bouton ouvre l’état actuel. Les notifications de démarrage sont best effort, sans ordonnanceur de relance durable. Aucun envoi SMTP réel n’a été effectué pendant la validation.

## SQL et installation

Revoir/sauvegarder le schéma puis appliquer `migrations/20261101_loan_runtime_schema.sql` et `migrations/20261101_meeting_timestamps.sql` avant de déployer ces chemins. Les scripts sont additifs, sans modification des soldes ou des échéanciers historiques. Ils supposent les tables de base et les migrations OnChat précédentes. Aucune migration ni modification de production n’a été exécutée. Coordonner web, WebSocket et Wallet 2.3/code12 ; OnChat Android n’a pas été modifié.

## Validation et limites

Build Next réussi avec les avertissements préexistants. Vérification ciblée TypeScript : zéro nouveau diagnostic ; sept diagnostics existaient déjà dans des branches USSD cartes/changement de PIN, hors des parcours de crédit vérifiés. Les trois fichiers de syntaxe préexistante hors périmètre restent isolés uniquement dans le lanceur temporaire.

Vérifications hors Git avec PostgreSQL WASM et le moteur de transaction réel : prix/promotions, ambiguïté de code-barres, falsification de QR, devis/compte/expiration, prix/frais modifiés, conversion, stock, double paiement, différents identifiants client/prêt/échéance, devise, paiement manuel/automatique, reprise idempotente, et conditions configurées. Les sessions, recherches tarifaires et transports externes sont isolés. Vérification des fonctions USSD effectives et du modèle de mails ; migrations et dates effectives testées avec admissions/fins réelles dans la base locale. Cela ne remplace pas les essais sur téléphone, passerelle opérateur ou fournisseurs SMTP/financiers réels.
