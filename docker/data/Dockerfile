# Default data volume container
# See http://howchoo.com/g/y2y1mtkznda/getting-started-with-docker-compose-and-django

# Busybox base image
FROM busybox

# Expected by monogodb
VOLUME /data/db

# Run when container is restared, otherwise docker tries to run /bin/echo which fails
CMD ["true"]
