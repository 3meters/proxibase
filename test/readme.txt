
Proxibase Tests

The easiest way to run the tests is to make sure you have a configtest.js file
in your $PROX directory.  It should be just like config.js except for the port
and database settings. The tests now automatically ensure they start using a 
clean generated database.  


Start the proxibase test server
===============================
cd $PROX
node prox -t

see node prox -h for additional command line options


Run the tests
=============
cd $PROX/test
node testprox

seed node prox -h for addtional command line options


