# Stage 1: Build Angular browser bundle
FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build -- --configuration production

# Stage 2: Serve with nginx
FROM nginx:stable-alpine

# Remove stock nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist/azure-insights-app/browser /usr/share/nginx/html

# Angular 21 may emit index.csr.html; nginx expects index.html
RUN if [ -f /usr/share/nginx/html/index.csr.html ] && [ ! -f /usr/share/nginx/html/index.html ]; then \
      mv /usr/share/nginx/html/index.csr.html /usr/share/nginx/html/index.html; \
    fi

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Azure App Service for Linux containers (default WEBSITES_PORT=8080 unless set)
ENV WEBSITES_PORT=8080
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
