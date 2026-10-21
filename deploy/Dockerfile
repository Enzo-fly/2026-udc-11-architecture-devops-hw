FROM node:latest

WORKDIR /app
ENV NODE_ENV=production
ENV SMS_TOKEN=CHANGE_ME

COPY . .

EXPOSE 8080
CMD ["node", "src/server.js"]
