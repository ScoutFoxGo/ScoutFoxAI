# ScoutFoxAI — single container: builds the web frontend and runs the Express
# API that also serves it. Works on AWS App Runner, ECS/EKS, Lightsail, or any
# container host (and Render). Start lean here; scale out later.
FROM node:20-slim

WORKDIR /app
COPY . .

# Installs web + server deps and builds web/dist (see root package.json "build").
RUN npm run build

ENV PORT=8787
EXPOSE 8787

# Production tip: set LIVE_ONLY=true + the keys in the platform's secret store
# (AWS Secrets Manager) so no placeholder data is ever served.
CMD ["npm", "start"]
