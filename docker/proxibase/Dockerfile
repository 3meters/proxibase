# Node proxibase web service

FROM node

ENV src /usr/local/prox
ENV dest /usr/local/prox

COPY $src/package.json $dest/package.json
COPY $src/node_modules $dest/node_modules
COPY $src/prox.js $dest/prox.js
COPY $src/lib $dest/lib
COPY config.js $dest/config/config.js
COPY keys/* /etc/ssl/

RUN sleep 3

ENTRYPOINT /usr/local/bin/node $dest/prox.js
