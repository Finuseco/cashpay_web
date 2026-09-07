# CashPay All USSD — refactor ciblé

Contenu :
- `ussd.router.ts` : entrée et navigation USSD.
- `ussd.actions.ts` : actions backend déplacées hors du routeur, sans supprimer les fonctions présentes dans le fichier fourni.
- `ussd.router.original.ts` : sauvegarde exacte du fichier source fourni.

Important : cette livraison est basée uniquement sur le `ussd.router.ts` fourni dans cette conversation. Les imports `@/...` restent ceux du projet CashPay All et doivent être résolus depuis la racine réelle du projet. La compilation isolée des deux fichiers ne peut donc pas valider les modules du projet qui ne sont pas inclus dans ce ZIP.

Le ZIP ne remplace pas les autres fichiers du projet et ne contient pas de nouvelle implémentation fictive de wallet, TV, MaxiCash, Mobile Money ou base de données.
