#! /bin/sh
# production proxibase startup script using nodemon
# see https://github.com/remy/nodemon

nohup nodemon main.js --watch lib --delay 20 >/var/log/prox/prox.log 2>&1 &
