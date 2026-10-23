# Déploiement VPS sans perdre le `.env`

`.env` n'est plus suivi par git (il est dans `.gitignore`). Mais le **premier** `git pull` après ce
changement supprimerait le `.env` du serveur (git applique la suppression du fichier suivi).

À faire UNE SEULE FOIS sur le VPS, avant le pull :

    cd /chemin/du/projet
    cp .env /root/cashpay.env.backup        # sauvegarde hors dépôt
    git pull origin main
    [ -f .env ] || cp /root/cashpay.env.backup .env

Ensuite, les prochains `git pull` ne touchent plus au `.env`.
Les secrets qui ont été commités dans l'historique doivent être changés (clés API, JWT, DB).
