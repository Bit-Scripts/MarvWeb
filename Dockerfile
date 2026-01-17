# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --loglevel verbose

COPY . .
RUN npm run build


# ---- runtime stage ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY package-lock.json ./package-lock.json
RUN npm ci --omit=dev

# serveur express
COPY --from=build /app/bin ./bin
COPY --from=build /app/app.js ./app.js

# ton code
COPY --from=build /app/config.js ./config.js
COPY --from=build /app/marv.js ./marv.js
COPY --from=build /app/routes ./routes
COPY --from=build /app/db ./db
COPY --from=build /app/views ./views
COPY --from=build /app/public ./public
COPY --from=build /app/dist ./dist

RUN mkdir -p /app/data && chmod -R 777 /app/data

EXPOSE 3017
CMD ["node", "bin/www"]


