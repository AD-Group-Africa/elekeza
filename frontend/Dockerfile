FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# --legacy-peer-deps: lockfile was generated with legacy peer resolution
# (vitest@5 vs @types/node@20 via @capacitor/cli tree); same locked versions install.
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
