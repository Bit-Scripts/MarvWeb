# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# genere index.html (pug) puis build vite -> dist/
RUN npm run build

# ---- runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# ton serveur + ce dont il a besoin
COPY --from=build /app/dist ./dist
COPY --from=build /app/marv.js ./marv.js
COPY --from=build /app/routes ./routes
COPY --from=build /app/db ./db
COPY --from=build /app/views ./views
COPY --from=build /app/public ./public

EXPOSE 3017
CMD ["node", "bin/www"]

