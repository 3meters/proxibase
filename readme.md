## Proxibase
Proxibase is the backing service for 3meters aircandi and related services

Web: [https://www.proxibase.com](https://www.proxibase.com)

API: [https://service.proxibase.com](https://service.proxibase.com)

## /_info
    returns table information for the rest API: Jayma was here

## /_do
    returns a list of custom web methods

## GET
For each table

    GET /tableName

returns up to 1000 records unsorted

    GET /tableName/:id1,id2

note the initial colon. returns records by _id

### GET Query Parameters
    lookups (default false)
returns each document with its lookup fields fully populated


## POST
1. set req.headers.content-type to 'application-json'
2. make sure req.body is parsable json
3. enclose new data in a data element, e.g: 

    req.body = {
      "data": {
        "field1": "foo",
        "field2": "bar" 
      }
    }

## DELETE
    DELETE /tablename/:id1,id2
deletes those records

    DELETE /tablename/:*
deletes all records in the table


### _id fields
Every proxibase record has a an immutable _id field that is unique within proxiabse.  The proxiabse server generates these on each record insert, or the client may supply one on insert. _id fields have this form, with dates and times represented in UTC: 

    tabl.yymmdd.scnds.mil.randm

meaning

    tableId.dateSince2000.secondsSinceMidnight.milliseconds.randomNumber


### To refer to a specific record
To address a record put ":" plus the recordId in the url, eg

    https://api.proxibase.com/students/:<studentid>

