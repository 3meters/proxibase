# Proxiapp dockerized node web app container.  Intended to be run
# under http, not https, inside a trusted docker container.

FROM node

ENV dest /usr/local/prox/

WORKDIR $dest

ADD package.json $dest
RUN npm install

ADD prox.js $dest
ADD lib $dest/lib
Add assets $dest/assets
ADD config/config.js.docker $dest/config/config.js

ENTRYPOINT node prox
