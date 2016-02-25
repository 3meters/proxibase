# Default data volume container
# See http://howchoo.com/g/y2y1mtkznda/getting-started-with-docker-compose-and-django

# Assume the mongo image has tuned its default data volume properly
FROM mongo:3.0

# Expected by monogodb
VOLUME /data/db

# Do not start mongo, just exit
ENTRYPOINT ["true"]
