# Proxiapp dockerized node web app container.  Intended to be run
# under http, not https, inside a trusted docker container.

FROM node

ENV dest /usr/local/prox/
ENV port 31201

WORKDIR $dest

ADD package.json $dest
RUN npm install

ADD prox.js $dest
ADD lib $dest/lib
ADD config/config.js.docker $dest/config/config.js

EXPOSE $port

ENTRYPOINT node prox
