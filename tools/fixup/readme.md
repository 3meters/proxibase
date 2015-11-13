Proxibase data fixup scripts

Generally these are run to fix up data in the procudtion database.

Each one was copied from the previous and modified, so they have
changed over time.  Generally they read the config file
/config/config.js, which includes the name of the database to
be fixed up.  This can be run from the production machine
itself, or on a copy of the production data that should be
hotswapped.

To run them, from the command line:

    node my_fixup_script.js


