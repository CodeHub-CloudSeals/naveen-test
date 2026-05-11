# Stage 1: Build Expo web app
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

ENV EXPO_NO_INTERACTIVE=1
ENV CI=1

RUN npx expo export --platform web

# Stage 2: Serve with nginx on port 8080
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
