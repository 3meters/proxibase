# Proxibase
Proxibase is the backing service for 3meters aircandi and related services

Web: https://www.proxibase.com

API: https://api.proxibase.com

## REST API
https://api.proxibase.com/__info

Returns table schema information

### _id fields
Every proxibase record has a an immutable _id field that is unique within proxiabse. _ids have this form, with dates and times represented in UTC: 

    tabl.yymmdd.scnds.mil.random

meaning

    tableId.dateSince2000.secondsSinceMidnight.milliseconds.randomNumber

### GET /tableName/__info
Returns information about the table's schema.

### GET /tableName
Returns the table's first 1000 records unsorted.

### GET /tableName/__ids:id1,id2
Returns records with the specified ids. Note the initial __ids:  Do quote or put spaces betweeen the id parameters themselves.

### GET /tableName/__names:name1,name2
Returns records with the specified names. Note the initial __names:  Do not quote or put spaces between the name parameters.  If the value of your name contains a comma, you cannot use this method to find it.  Use the __do/find method in this case. 

### GET /tablename/[__ids:...|__names:.../]childTable1,childTable2|*
Returns all records specified with subdocuments for each child table specified. The wildcard * returns all child documents.  All fields from child documents are returned.  The query limit is applied both to the main document array and to each of its child arrays. Filters only apply to the main document, not to the document's children.

### GET /tablename/__genid
Generates a valid id for the table with the UTC timestamp of the request.  Useful if you want to make posts to mulitple tables with the primary and foreign keys preassigned.

### GET parameters
Place GET query parameters at the end of the URL beginning with a ?. Separate parameters with &. Parameter ordering does not matter.

    ?__find={"firstname":"John","lastname":{"$in":["Smith","Jones"]},"age":{"$lt":5}}
Returns the records in the table found using mongodb's [advanced query syntax](http://www.mongodb.org/display/DOCS/Advanced+Queries). The value of __find must be parsable JSON. The rest of the url need not.

    ?__fields=_id,name,created
Returns only the fields specified. _id is always returned. 

    ?__limit=30
Returns only the first 30 records. Max 1000.

    ?__lookups=true
Returns each document with its lookup fields fully populated. Default false.


### POST Rules
1. Set req.headers.content-type to 'application/json'
2. Make sure req.body is parsable json
3. Write the data for the new object inside a data element in the request body.  The new element can either be a simple object or an array of objects.
4. If you use an array, currently only one element is supported per post, but this may change in the future

    request.body = {
      "data": {
        "field1": "foo",
        "field2": "bar" 
      }
    }

or

    request.body = {
      "data": [ 
        {
          "field1": "foo",
          "field2": "bar" 
        }
      ]
    }

### POST /tablename
Inserts req.body.data or req.body.data[0] into the tablename table.  If a value for _id is specified it will be used, otherwise the server will generate a value for _id.  Only one record may be inserted per request. If you specifiy values for any of the system fields, those values will be stored.  If you do not the system will generates defaults for you.

### POST /tablename/__ids:id1
Updates the record with _id = id1 in tablename.  Non-system fields not inlucded in request.body.data or request.body.data[0] will not be modified.

### DELETE /tablename/__ids:id1,id2
Deletes those records.

### DELETE /tablename/__ids:*
Deletes all records in the table.

<a name="webmethods"></a>
## Custom Web Methods
[https://api.proxibase.com/__do](https://api.proxibase.com/__do)

Lists the web methods. POST to /__do/methodName executes a method passing in the full request and response objects. The request body must be in JSON format. 

### POST /__do/echo
Returns request.body

### POST /__do/find
Is a way to do a GET on any table in the system, but with the paramters in the request body rather than on the query string. find expects request.body to contain JSON of this form:

    {
      "table": "tableName",
      "ids": ["_id1", "_id2"],
      "names": ["name1", "name2"],
      "fields": ["field1","field2"],
      "find": {"name":"name1"},
      "children": ["childTable1","childTable2"],
      "lookups": true,
      "limit": 25
    }

The table property is required.  All others are optional. The value of the find property is passed through to mongodb unmodified, so it can be used to specify any clauses that mongodb supports, including sorting, offset, etc.  See mongodb's [advanced query syntax](http://www.mongodb.org/display/DOCS/Advanced+Queries) for details. This may present a security problem, so will likely be removed once the public query syntax becomes more full-featured.

### POST /__do/getEntitiesForBeacons

with request.body

    {
      "beaconIds": ["0003:01:02:03:04:05:06", "0003:11:12:13:14:15:16"],
      "getChildren": true   // optional
    }

returns all entites linked to the specified beacons and their immediate children and comments

### POST /__do/getEntities

with request.body

    {
      "enityIds": ["entId1" "entId2"],
      "getChildren": true   // optional
    }

returns all entites and their immediate children and comments.

### POST /__do/getEntitiesForUser

with request.body

    {
      "userEmail": "jay@3meters.com"
      "getChildren": true   // optional
    }

returns all entites created by that user and their immediate childrewn and comments.  

## Etc
* [Building a Proxibase Server](proxibase/wiki/ServerSetup)
* [Building a Dev Machine](proxibase/wiki/DevSetup)

## Todo
* bug: GET /tablename,foo
*
* __do/schema?format=full
* rest.get: lookups for links
* util.sendErr => res.err
* rest.get: child counts
* rest.get: field lists for lookups
* rest.get: fields lists for children
* rest.get: find on children, innner and outer
* rest.get: find on parents, inner and outer
* rest.get: table.childtable.childtable...
* rest.get: singleton get
* do version migration in place
* make direct connection through mongod driver 

* rest.post: insert array
