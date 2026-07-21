FROM node:20-bookworm-slim AS dependencies

ENV NODE_ENV=production
WORKDIR /app
COPY governed-runtime/package.json governed-runtime/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node governed-runtime/package.json ./package.json
COPY --chown=node:node governed-server.js ./
COPY --chown=node:node config/database.js config/governed.js config/security.js ./config/
COPY --chown=node:node lib/governedApp.js lib/governedAuth.js lib/governedDocumentWorkflow.js lib/governedProviders.js lib/migrations.js ./lib/
COPY --chown=node:node routes/governed-documents.js ./routes/
COPY --chown=node:node scripts/migrate.js ./scripts/
COPY --chown=node:node migrations ./migrations

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "governed-server.js"]
