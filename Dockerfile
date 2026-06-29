# Hunter — imagem estática servida por nginx
FROM nginx:1.27-alpine
RUN rm -rf /usr/share/nginx/html/*
COPY index.html app.js hunter_logo_icon.png /usr/share/nginx/html/
COPY vendor/ /usr/share/nginx/html/vendor/
# nginx:alpine já expõe a porta 80 e inicia sozinho
