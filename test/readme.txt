
Proxibase Tests

Last Updated: 6/15/12

The easiest way to run the tests is to make sure you have a configtest.js file
in your $PROX directory. See config.js.template for settings that should
change from the defaults The tests now automatically ensure they start using a
clean generated database, and will start the test server automatically.

The tests expect a database that is created from tools/genData.js.  Generally
this is run infrequently, and saved as smokeDataTemplate in mongoose.  When
the tests are run this is copied over smokeData.  If your template is stale,
and doesn't match the current tests, simply drop the template like so:

mongoose
> use smokeDataTemplate
> db.dropDatabase()
> exit

When the test runner starts and fails to find smokeDataTemplate, it will run
the generator program make a fresh one, and you will be back in sync.  

Important: it will not start mongod for you, you must do that yourself.


Run the tests automatically
===========================

    cd $PROX/test
    node run

The test server's output will be written to $PROX/test/testServer.log

see node testprox -h for addtional command line options



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


