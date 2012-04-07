
Proxibase Tests

Last Updated: 4/6/12

The easiest way to run the tests is to make sure you have a configtest.js file
in your $PROX directory.  It should be just like config.js except for the port
and database settings. The tests now automatically ensure they start using a
clean generated database, and will start the test server automatically.

Important: it will not start mongod for you, you must do that yourself.


Run the tests automatically
===========================

    cd $PROX/test
    node run

The test server's output will be written to $PROX/test/testServer.log

seed node testprox -h for addtional command line options



Run the tests manually
======================
0. Ensure that mongod is running

1. Ensure the test server config file, usally /config/configtest.js exists

2. Ensure that the database pointed to by the config file matches 

    constants.dbProfile.smokeTest

You can use $PROX/tools/pump/gen to create a new database

3. Start the proxibase test server

    cd $PROX
    node prox -t

see node prox -h for additional command line options

$. Run the tests

    cd $PROX/test
    nodeunit tests


