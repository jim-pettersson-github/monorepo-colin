# The room server and its TURN relay in one container, deployed by Dokploy on the home dev host.
# Apache + PHP serves public/; coturn relays game traffic for devices whose networks block direct contact.
FROM php:8.5-apache

RUN apt-get update \
  && apt-get install -y --no-install-recommends coturn iproute2 \
  && rm -rf /var/lib/apt/lists/*

COPY public/ /var/www/html/
COPY docker/entrypoint.sh /usr/local/bin/game-server

# The database lives in a volume, outside the webroot, so nothing can download it.
RUN chmod +x /usr/local/bin/game-server && mkdir -p /data && chown www-data:www-data /data
ENV GAME_DB=/data/games.sqlite
VOLUME /data

EXPOSE 80 3478/udp 3478/tcp
HEALTHCHECK --interval=30s --timeout=5s CMD curl -fsS 'http://127.0.0.1/api.php?a=health' > /dev/null || exit 1
ENTRYPOINT ["game-server"]
