
Proxibase Tests

Prereqs
=======
sudo npm install -g nodeunit

Target
======
By default will test the local server.  To test production create a file
named config.json in this directory and put this in it:

{
  "server": "https://api.proxibase.com:443"
}

To Run
======
nodeunit tests
