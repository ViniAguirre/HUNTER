# Hunter — Fase 1: backend Node + front
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]
