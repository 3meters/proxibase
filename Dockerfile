# Proxiapp dockerized node web app container.  Intended to be run
# under http, not https, inside a trusted docker container.

FROM node

ENV dest /usr/local/prox/

ADD package.json $dest
ADD prox.js $dest
ADD lib $dest/lib
ADD config/config.js.docker $dest/config/config.js

WORKDIR $dest

# Todo: figure out how to docker-cache the modules
RUN npm install

ENTRYPOINT node prox
