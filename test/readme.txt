
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

node genSmoke

Target
======
By default will test the local server.  To test production create a file
named config.json in this directory and put this in it:

{
  "server": "https://api.proxibase.com:443"
}

The proxibase server being tested must be pointed at the 'smokeData' mongo
database:

node prox -d smokeData

To Run
======
nodeunit tests
