# Hunter — Fase 3: backend Node + front + motor de prospecção (worker)
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY server.js worker.js tenant.js mcp.js tags.js ./
COPY jobs ./jobs
COPY providers ./providers
COPY public ./public

# Carimbo da build: sem isso não dá pra saber, olhando o serviço no ar, se o
# redeploy pegou a versão nova ou se o Portainer seguiu com a imagem antiga —
# a única resposta era "parece que não atualizou". O workflow passa estes dois
# como build-args; fora dele ficam vazios e o /api/health diz "desconhecida".
ARG GIT_SHA=""
ARG BUILD_TIME=""
# Release (tag vX.Y.Z) de que a build saiu — vazia enquanto não houver release.
ARG APP_VERSION=""
ENV HUNTER_GIT_SHA=$GIT_SHA
ENV HUNTER_BUILD_TIME=$BUILD_TIME
ENV HUNTER_VERSION=$APP_VERSION

EXPOSE 3000
CMD ["node", "server.js"]
