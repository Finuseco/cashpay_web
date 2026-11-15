# Wallet Best : scanners, opérations agent et paramètres

## Scanner et prix autoritaires

`/api/v1/scanpay/scan` et `/api/v1/shopping/scan` interprètent portefeuille, produit/code-barres, panier POS et demande de paiement. Les articles et promotions viennent du catalogue PostgreSQL ; un prix inclus dans un QR ne remplace jamais celui du produit. Un code partagé par plusieurs vendeurs présente leurs articles distincts. Les QR `cashpay:` et `cashpay://` sont pris en charge. Les liens HTTP interprétés sont limités à l’hôte CashPay et aux paramètres walletId/wallet ; un lien quelconque n’est pas un bénéficiaire.

Les ventes `POS_SALE` sont maintenant **sans frais**, aussi bien dans le devis que dans le moteur transactionnel. Les demandes de paiement et transferts conservent leurs règles distinctes. Les promotions sont prises en compte pour le prix de catalogue et le devis final. Les codes inconnus, mauvais vendeurs, quantités/stock/prix invalides sont refusés. Le devis signé vérifie encore prix, taux, bénéficiaire, payeur et expiration au débit ; l’écriture et la baisse de stock sont atomiques. Les taux USD/CDF/EUR de secours et les contre-valeurs par défaut ont été retirés d’Android. Si le taux direct serveur manque, le devis reste requis ; aucun taux inverse n’est inventé. Les estimations de panier ne constituent pas une autorisation de débit : le montant final présenté avant PIN est le devis serveur.

## Opérations agent

Android utilise le même parcours signé que le web :

- Retrait agent : `agent_withdraw`, identification → confirmation identité → montant/devis → confirmation montant → canal OTP → OTP à six chiffres. Chaque nouvelle étape conserve le nouvel operationId. L’ancien usage `client_withdraw` dans l’espace agent et les étapes omises empêchaient l’exécution.
- Remboursement : `/api/v1/agent/loan-repayment`, identification du prêt → confirmation identité → montant/frais/débit → confirmation → PIN Agent. Les anciennes routes Android loan-target et loan-repay ne sont plus utilisées. Une devise non fournie à l’identification permet de retrouver le prêt dans sa devise réelle ; le paiement doit ensuite la respecter.

Le tarif de remboursement est inclus dans l’opération signée et comparé au débit effectif. Un changement provoque un rollback. L’identifiant de l’opération est journalisé dans les métadonnées existantes ; verrou et reçu empêchent le double débit du même remboursement. Les commissions affichées proviennent de la réponse, sans commission ni référence inventée. Les signatures utilisent AGENT_OPERATION_SECRET si défini, sinon JWT_SECRET existant ; aucun nouveau secret n’est nécessaire si JWT_SECRET est déjà configuré.

## PIN, profil et abonnement

Le PIN du portefeuille dispose de son écran Android et de `/api/v1/auth/change-pin` : ancien PIN, nouveau PIN à quatre chiffres et confirmation. Le changement vérifie la session du titulaire, verrouille le hash et prend en charge les anciens PIN numériques comme bcrypt. Il ne modifie pas les PIN des cartes Marqeta : les cartes gardent leur propre API, et une panne/absence de configuration cartes ne bloque plus le PIN du portefeuille.

`PATCH /api/v1/auth/me` vérifie le PIN depuis le bon module et son résultat success. Le nom Android fullName est compatible avec full_name. La mise à jour du numéro emploie l’indicatif/pays et refuse un numéro déjà attribué. L’action de mise à jour exige aussi le titulaire et son PIN pour les champs de données ; seuls les champs de profil autorisés peuvent être écrits. Rôle, hash PIN et clés SQL ne peuvent pas être modifiés par ce parcours. Les médias restent sur leurs routes dédiées.

L’abonnement Agent affiche le tarif USD réel de `/api/v1/agent/subscription/fees` avant validation. L’activation utilise l’authentification existante correcte et exige acceptedFee ; un tarif modifié ou absent est refusé. Un abonnement actif n’est pas débité une seconde fois. Le rôle Agent n’est attribué qu’après débit et enregistrement validés.

## Livraison et vérifications

Déployer ce correctif backend avant la version Android correspondante. Les anciennes versions Android qui n’envoient pas acceptedFee ne peuvent pas autoriser un débit d’abonnement non affiché. Aucune table, colonne, enum ou migration SQL ajoutée : les reçus utilisent transactions.metadata existant.

Vérifications sur PostgreSQL temporaire et fonctions réelles : catalogue et promotions, QR avec faux prix, frais POS nuls, changement de tarif/taux, quantités, stock, devis signés et retry ; prêts, échéances et remboursements ; remboursement agent avec reçu rejouable et rollback des frais modifiés ; PIN bcrypt/ancien format, autre compte et ancien PIN incorrect ; mise à jour du nom/téléphone, numéro dupliqué et refus de champs privilégiés ; tarif d’abonnement, consentement, PIN, activation et absence de double débit. Les transitions signées retrait/remboursement sont exécutées avec fournisseurs de notification et de paiement isolés.

Compilation Android `:app:compileDebugKotlin` ; contrôle de syntaxe et comparaison sémantique TypeScript des dix modules modifiés, sans nouvelle erreur. Le build web global reste limité par les erreurs préexistantes documentées dans le rapport précédent (paypal.ts, bitcoin-balance-card.tsx, events/layout.tsx). Aucun test sur téléphone physique, fournisseur bancaire ou base de production, et aucun nouveau binaire de production signé n’est annoncé. Les scénarios restent hors Git.
