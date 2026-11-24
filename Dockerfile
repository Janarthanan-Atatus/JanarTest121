# INTENTIONALLY INSECURE - FOR SCANNER TESTING ONLY
# ISSUE: Outdated, end-of-life base image with known CVEs
FROM node:16-bullseye

# ISSUE: apt-get install without version pinning or --no-install-recommends
RUN sed -i -e 's|deb.debian.org/debian-security|archive.debian.org/debian-security|g' \
           -e 's|deb.debian.org/debian|archive.debian.org/debian|g' \
           -e '/bullseye-updates/d' /etc/apt/sources.list \
    && apt-get -o Acquire::Check-Valid-Until=false update \
    && apt-get install -y curl wget netcat

WORKDIR /app

# ISSUE: ADD used instead of COPY
ADD package.json /app/
RUN npm install
ADD app.js /app/

# ISSUE: Secrets baked into the image
COPY config.js /app/config.js

# ISSUE: SSH port exposed
EXPOSE 22 3000

# ISSUE: Container runs as root (no USER instruction)
CMD ["node", "app.js"]
