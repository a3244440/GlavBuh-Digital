FROM node:24-alpine
WORKDIR /app
# Кабинет берёт логотип, иконку и шрифты из public/ сайта.
COPY public/fonts ./public/fonts
COPY public/logo-gb.png public/favicon.ico ./public/
COPY cabinet/package.json cabinet/package-lock.json ./cabinet/
RUN cd cabinet && npm ci --omit=dev
COPY cabinet ./cabinet
WORKDIR /app/cabinet
ENV NODE_ENV=production PORT=3100 CABINET_DB=sqlite:/data/cabinet.db
RUN mkdir -p /data && chown node /data
VOLUME /data
EXPOSE 3100
USER node
CMD ["node", "src/app.js"]
