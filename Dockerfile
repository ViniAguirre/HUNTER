# Hunter — Fase 3: backend Node + front + motor de prospecção (worker)
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY server.js worker.js ./
COPY jobs ./jobs
COPY providers ./providers
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]
