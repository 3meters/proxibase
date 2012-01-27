#! /bin/sh
LOG=/var/log/prox.log
forever start -a -l $LOG -o $LOG -e $LOG main.js
