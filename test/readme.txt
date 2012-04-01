
Proxibase Tests

Prereqs
=======
sudo npm install -g nodeunit

Smoke Test Data
===============
The mongo server used for the smoke test must have the fully populated smokeData 
database. To generate the smokeData database, run the genSmoke module in the pump 
directory. The host and port settings come from the local config file and the database 
is a setting from the smokeDataProfile in /test/constants. The proxibase service must 
be running if the smokeDataProfile is using a mongoose connection. Running genSmoke 
always rebuilds the smokeData database.


Create the test data set
========================
cd $PROX/tools/pump
node genSmoke


Start proxibase using database smokeData listening to the test port
===================================================================
cd $PROX
node prox -d smokeData -p 8044


Change the test target (optional)
=================================
By default the tests run against https://api.localhost:8044.  To change the 
target, run the test command below passing in the target url folloing the 
-s or --server flag on the command line


Change the test diretory (optional)
===================================
If you are working on new tests that aren't ready to be make part of the main suite, 
you can put then in a differnt folder and run them separately using the -t flag


Run the tests
=============
node testprox -s <testServerUrl> -t <testDir>


For the lazy
============
There is a unix shell script file in $PROX/bin called proxtest that automates
these steps
