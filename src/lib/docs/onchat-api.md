# Documentation de l'API OnChat

## Introduction

Bienvenue dans la documentation de l'API OnChat. Ce document fournit toutes les informations nécessaires pour développer une application client (par exemple, en React Native) interagissant avec les services backend d'OnChat.

L'API est basée sur les principes REST et utilise le format JSON pour toutes les communications.

**URL de base de l'API :** La base de l'URL de l'API doit être configurée dans une variable d'environnement côté client, par exemple `NEXT_PUBLIC_API_BASE_URL`.

**Exemple de valeur pour la variable d'environnement :**
`NEXT_PUBLIC_API_BASE_URL=http://api.cashpay-all.com/v1`

**Utilisation dans le code client :**
```javascript
const ONCHAT_API_URL = `${process.env.NEXT_PUBLIC_API_BASE_URL}/onchat`;
```

---

## 1. Authentification

L'accès à l'API est protégé par une **Clé API**. Chaque requête doit inclure une en-tête `Authorization` avec votre clé.

*   **Header:** `Authorization: Bearer <VOTRE_CLÉ_API_SECRETE>`

Une fois l'application authentifiée, l'authentification de l'utilisateur final se fait via un jeton JWT.

1.  **POST `/api/v1/auth/initiate-login`**: Le client (avec sa clé API) envoie l'ID du portefeuille.
2.  Le serveur envoie un OTP (One-Time Password) au numéro de téléphone de l'utilisateur.
3.  **POST `/api/v1/auth/verify-otp`**: Le client envoie l'ID utilisateur et l'OTP.
4.  Si l'OTP est valide, le serveur renvoie un **jeton JWT**. Ce jeton doit être inclus dans l'en-tête `Authorization` de toutes les requêtes authentifiées suivantes au nom de l'utilisateur.
    *   **Header:** `Authorization: Bearer <VOTRE_JETON_JWT>`

---

## 2. Utilisateurs et Contacts

### 2.1. Obtenir le Profil de l'Utilisateur Actuel

-   **Endpoint:** `GET /users/me`
-   **Description:** Récupère les informations détaillées de l'utilisateur actuellement authentifié.
-   **Réponse (200 OK):**
    ```json
    {
      "success": true,
      "user": {
        "id": 1,
        "full_name": "John Doe",
        "phone": "+243812345678",
        "profile_photo": "/images/avatars/user1.png",
        "availabilityStatus": "available"
      }
    }
    ```

### 2.2. Mettre à jour le Statut de Disponibilité

-   **Endpoint:** `PUT /users/me/status`
-   **Description:** Met à jour le statut de présence de l'utilisateur.
-   **Corps de la Requête:**
    ```json
    { "status": "busy" }
    ```
    *   `status` (chaîne): 'available', 'busy', 'away', 'offline'.
-   **Réponse (200 OK):**
    ```json
    { "success": true, "message": "Statut mis à jour." }
    ```

### 2.3. Vérifier les Contacts du Téléphone

-   **Endpoint:** `POST /api/onchat/contacts/check`
-   **Description:** Permet de vérifier une liste de numéros de téléphone pour voir lesquels sont déjà des utilisateurs OnChat.
-   **Corps de la Requête:**
    ```json
    {
      "phoneNumbers": ["+243812345678", "+33612345678"]
    }
    ```
-   **Réponse (200 OK):**
    ```json
    {
        "success": true,
        "results": [
            {
                "phone": "+243812345678",
                "isRegistered": true,
                "user": {
                    "full_name": "John Doe",
                    "id_wallet": "CD1234567890",
                    "profile_photo": "/images/avatars/user1.png"
                }
            },
            {
                "phone": "+33612345678",
                "isRegistered": false,
                "user": null
            }
        ]
    }
    ```

---

## 3. Conversations et Messages

### 3.1. Lister les Conversations

-   **Endpoint:** `GET /conversations`
-   **Description:** Récupère une liste paginée de toutes les conversations de l'utilisateur.
-   **Réponse (200 OK):**
    ```json
    {
      "success": true,
      "conversations": [
        {
          "id": "conv_1_2",
          "contact": { "id": 2, "full_name": "Jane Smith", "profile_photo": "..." },
          "lastMessage": "Super, merci !",
          "lastMessageTimestamp": "2024-07-28T10:30:00Z",
          "unreadCount": 2
        }
      ]
    }
    ```

### 3.2. Obtenir les Messages d'une Conversation

-   **Endpoint:** `GET /conversations/{conversationId}/messages`
-   **Description:** Récupère les messages pour une conversation spécifique.

### 3.3. Envoyer un Message

-   **Endpoint:** `POST /conversations/{conversationId}/messages`
-   **Description:** Envoie un nouveau message.
-   **Corps de la Requête:**
    ```json
    {
      "content": "Bonjour",
      "type": "text"
    }
    ```

### 3.4. Modifier un Message

-   **Endpoint:** `PUT /api/onchat/messages/{messageId}`
-   **Description:** Met à jour le contenu d'un message existant. L'utilisateur ne peut modifier que ses propres messages.
-   **Corps de la Requête:**
    ```json
    { "content": "Bonjour, je voulais dire..." }
    ```
-   **Réponse (200 OK):** `{ "success": true, "message": { ... } }`

### 3.5. Supprimer un Message

-   **Endpoint:** `DELETE /api/onchat/messages/{messageId}`
-   **Description:** Supprime un message. L'utilisateur ne peut supprimer que ses propres messages.
-   **Réponse (200 OK):** `{ "success": true }`

---

## 4. Statuts

### 4.1. Publier un Statut

-   **Endpoint:** `POST /api/onchat/statuses`
-   **Description:** Poste un nouveau statut (texte, image, ou vidéo).
-   **Corps de la Requête (Texte):**
    ```json
    { "type": "text", "content": "Super journée !", "backgroundColor": "#3498db" }
    ```
-   **Réponse (201 Created):** `{ "success": true }`

### 4.2. Obtenir les Statuts des Contacts

-   **Endpoint:** `GET /api/onchat/statuses`
-   **Description:** Récupère les statuts actifs des contacts, groupés par utilisateur.
-   **Réponse (200 OK):**
    ```json
    {
        "success": true,
        "statusGroups": [
            {
                "contact": { "id": 2, "full_name": "Jane Smith", "profile_photo": "..." },
                "statuses": [ { "id": 101, "type": "image", "content": "/images/...", "createdAt": "..." } ]
            }
        ]
    }
    ```

### 4.3. Intégration des Pages "MonPays" (Nouveau)

Pour renforcer la visibilité des entreprises certifiées, il est possible de partager une page "MonPays" en tant que statut.

#### Publication

-   **Endpoint:** `POST /api/onchat/statuses`
-   **Description:** Pour partager une page MonPays, utilisez le type de statut `monpays_page`. Le `content` doit être l'ID de la page MonPays.
-   **Corps de la Requête :**
    ```json
    {
      "type": "monpays_page",
      "content": "ID_DE_LA_PAGE_MONPAYS"
    }
    ```

#### Récupération

-   **Endpoint:** `GET /api/onchat/statuses`
-   **Description:** L'API retournera un objet `status` de type `monpays_page` avec des métadonnées enrichies.
-   **Exemple dans la Réponse :**
    ```json
    {
      "id": 105,
      "type": "monpays_page",
      "content": "ID_DE_LA_PAGE_MONPAYS",
      "createdAt": "...",
      "monpays_details": {
        "companyName": "Nom de l'Entreprise",
        "companyLogo": "/images/logos/...",
        "bannerUrl": "/images/banners/...",
        "category": "E-commerce",
        "ownerWalletId": "CP1234567890",
        "pageUrl": "/monpays/company/ID_DE_LA_PAGE_MONPAYS"
      }
    }
    ```

#### Actions Côté Client

À la réception d'un statut de type `monpays_page`, le client doit afficher une carte cliquable en utilisant `monpays_details` :

-   **Affichage :** Utilisez `bannerUrl` pour l'image de fond, `companyName` et `companyLogo` pour l'identification.
-   **Action "Écrire" :** Sur clic, utilisez l' `ownerWalletId` pour initier une conversation avec le propriétaire de la page.
-   **Action "Rejoindre la Page" :** Un bouton ou le clic général sur la carte doit rediriger l'utilisateur vers la `pageUrl`.

---

## 5. Groupes

### 5.1. Créer un Groupe

-   **Endpoint:** `POST /api/onchat/groups`
-   **Description:** Crée un nouveau groupe de discussion et un portefeuille de groupe associé.
-   **Corps de la Requête:**
    ```json
    {
      "name": "Projet de Fin d'Année",
      "description": "Coordination pour le projet",
      "currency": "USD"
    }
    ```
-   **Réponse (201 Created):**
    ```json
    {
        "success": true,
        "group": { "id": 12, "name": "Projet de Fin d'Année", "group_wallet_id": "GR00000012", ... }
    }
    ```

### 5.2. Lister les Groupes de l'Utilisateur

-   **Endpoint:** `GET /api/onchat/groups`
-   **Description:** Récupère tous les groupes dont l'utilisateur est membre.
-   **Réponse (200 OK):** ` { "success": true, "groups": [ ... ] }`

### 5.3. Obtenir les Détails d'un Groupe

-   **Endpoint:** `GET /api/onchat/groups/{groupId}`
-   **Description:** Récupère les informations détaillées d'un groupe, y compris la liste des membres.
-   **Réponse (200 OK):** `{ "success": true, "group": { ... } }`

### 5.4. Ajouter un Membre

-   **Endpoint:** `POST /api/onchat/groups/{groupId}/members`
-   **Description:** Ajoute un nouvel utilisateur à un groupe (requiert des droits d'administrateur).
-   **Corps de la Requête:** `{ "userId": 5 }`
-   **Réponse (200 OK):** `{ "success": true }`

### 5.5. Retirer un Membre

-   **Endpoint:** `DELETE /api/onchat/groups/{groupId}/members/{memberId}`
-   **Description:** Retire un utilisateur d'un groupe (requiert des droits d'administrateur).
-   **Réponse (200 OK):** `{ "success": true }`

---

## 6. Appels et Transferts

*(Les sections pour les appels et les transferts d'argent dans le chat restent les mêmes que précédemment, utilisant les API Zoom et les mécanismes de transaction internes de CashPay.)*
