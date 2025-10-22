# Étape 1: Build de l'application
FROM node:18-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm ci

# Copier tout le code source
COPY . .

# IMPORTANT: Déclarer les arguments de build
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY

# Les exposer comme variables d'environnement pour Vite
ENV VITE_SUPABASE_URL=https://supabasekong.cdocoaching.com
ENV VITE_SUPABASE_PUBLISHABLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc1ODUzMDc2MCwiZXhwIjo0OTE0MjA0MzYwLCJyb2xlIjoiYW5vbiJ9.pJHSOerGt6DBqFOaS_fP9esFcxHKGC5U6dik4h06FBQ

# Build de l'application
RUN npm run build

# Étape 2: Serveur de production avec Nginx
FROM nginx:alpine

# Copier les fichiers buildés depuis l'étape précédente
COPY --from=builder /app/dist /usr/share/nginx/html

# Copier le configuration Nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exposer le port 80
EXPOSE 80

# Démarrer Nginx
CMD ["nginx", "-g", "daemon off;"]
