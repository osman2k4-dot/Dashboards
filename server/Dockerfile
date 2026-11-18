FROM node:20-alpine
WORKDIR /srv/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
# The web app is served from the repository root (one level up).
COPY app-progress-diary.html index.html ../
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
