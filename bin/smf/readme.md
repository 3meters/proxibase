This file controls running proxibase as a service on a Joyent smartOS / Oracle
Solaris machine.

The reason this is important is that it is the recommended way on a Solaris
derived system to automatically start a service after a system reboot.  The
proxibase server at Joyent has been rebooted occasionally, and this system
allows proxibase to restart without human intervention.

This file relies on the proxibase management script prox/bin/prox.  Prox in
turn relies on being able to write to 2 directories and 3 files on the system
when signed in as the admin user, not the root user. For a new installion,
the safest way is to precreate these files, and change their owner to "admin"
and their group to "staff".  (Arguably we should create a user called
"proxibase" to run the process, but that seems more complicated.)

The files are:

    /var/run/prox.pid
    /var/log/prox/
    /var/log/prox/prox.log
    /var/log/prox/proxerr.log
    /var/log/prox/old/

To load the service definition

    cd <prox>/bin/smf
    sudo svccfg import manifest.xml

Make sure proxibase is not running

    prox look

The enable the service

    sudo svcadm enable prox

The service should now be running

    prox look

If not, disable the service and start debugging

    sudo svcadm disable prox

To see the state of the solaris service itself

    svcs -l prox

A running service should be both enabled and online.  A non-running
service should either not exist, or should appear as both disabled
and offline.
