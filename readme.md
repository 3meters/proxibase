## Proxibase
Proxibase is the backing service for 3meters aircandi and related services

Web: [https://www.proxibase.com](https://www.proxibase.com)

API: [https://api.proxibase.com](https://api.proxibase.com)

For each table

    GET /tableName

returns the first 1000 records

To post data to a table
----
1. set req.headers.content-type to 'application-json'
2. make sure req.body is parsable json
3. enclose the new records data in a data element, e.g: 

    req.body = {
      "data": {
        "field1": "foo",
        "field2": "bar" 
      }
    }

Ids
-----
Every record in the system has a an _id field that is unique per server instance.  The server generates these on each record insert.  It has this form, with dates and times represented in UTC: 

    tabl.yymmdd.scnds.mil.randm

meaning

    tableId.dateSince2000.secondsSinceMidnight.milliseconds.randomNumber

To refer to a specific record
--------
To address a record put ":" plus the recordId in the url, eg

    https://api.proxibase.com/students/:<studentid>

Supported Verbs
----------

    GET /table
    GET /table/:_id,_id,... 
    POST /table/  body = '"data": { }'  // insert
    POST /table/:_id  body = '"data": { }' // update NYI 
    DELETE /table/:_id,_id,...

