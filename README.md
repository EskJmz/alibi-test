# Alibi — Guide de démarrage

## Lancer en local

```bash
# 1. Installer les dépendances (une seule fois)
npm install

# 2. Lancer le serveur
npm start
```

Ouvrir http://localhost:3000 dans le navigateur.

Pour tester avec plusieurs appareils sur le même réseau Wi-Fi :
- Trouver votre IP locale (ex: 192.168.1.42) avec `ipconfig` (Windows) ou `ifconfig` (Mac/Linux)
- Les autres appareils accèdent via http://192.168.1.42:3000

---

## Déployer sur Railway (gratuit, en ligne)

1. Créer un compte sur https://railway.app
2. Cliquer "New Project" → "Deploy from GitHub repo"
3. Connecter votre GitHub et uploader ce dossier
4. Railway détecte automatiquement Node.js et lance `npm start`
5. Un lien public est généré (ex: https://alibi-xxx.railway.app)

---

## Structure des fichiers

```
alibi/
├── server/
│   ├── index.js      ← Serveur Node.js + Socket.io (logique du jeu)
│   └── content.js    ← Alibis et questions pré-écrits
├── public/
│   ├── index.html    ← Interface utilisateur (toutes les vues)
│   ├── css/
│   │   └── style.css ← Design (couleurs, typographie, responsive)
│   └── js/
│       ├── timer.js  ← Gestion des arcs SVG animés
│       └── app.js    ← Logique client (Socket.io, navigation)
├── package.json      ← Dépendances Node.js
└── README.md         ← Ce fichier
```
