# Proxibase
Proxibase is the backing service for 3meters aircandi and related services

Web: https://www.proxibase.com

API: https://api.proxibase.com

## AUTHENTICATION
Users can be authenticated locally with a password, or by a oauth provider such as Facebook, Twitter, or Google.  Their authentication source is stored in the users.authSource field which is required.  Valid values may be found in util.statics.authSources.  The users table now requires either a password or valid oauth credentials to be stored before a user record to be created.  The email field is now unique.

### Local
If a new user is created with a password we assume the authSource is local.  We validate that the password is sufficiently strong before saving, and we save a one-way hash of the password the user entered.  See the users schema for the password rules and hash methods.

Users sign in via a new api:

    /auth/signin
    method: post
    body: {
      user: {
        name: (name or email will work, case-insensitive)
        password: password  (case-sensitive)
      }
    }

On success the api returns a session object with two fields of interest, _owner and key.  _owner is user's _id, and key is a session key.  In order to validate a request, include those values on each request, either as query parameters like so:

    /data/users?user=0000.120628.57119.055.350009&session=fb3f74034f591e3053e6e8617c46fb35
    method:  get, post, or delete

or as fields in the body of a post like so:

    /do/find
    method: post
    body: = {
      table:'users',
      user: 0000.120628.57119.055.350009
      session: fb3f74034f591e3053e6e8617c46fb35
    }

If you pass invaild session credentials the request will fail with a 401 (not authorized).  If they are valid, all responses will contain a user object that includes the user's id and name. Sessions are bound to a particular client IP address.  They expire after two weeks without use.

Sessions can be destroyed via

    /auth/signout
    method: post
    body: {
      user: user._id
      session: session.key
    }

User passwords can no longer be updated via the ordinary rest methods, but can only be changed via a new change password api:

    /auth/changepw  
    method: post
    body: {
      user:{
        _id:  user._id
        oldPassword: oldPassword
        newPassword: newPassword
      }
    }

### Oauth

Signin via ouath like so:

    /auth/signin/facebook|twitter|google

session management after a sucessful authentication is the same as with local authentication.  If the user authenticates via an oauth provider, we store their provider credentials and user key, allowing us to access their picture and other provider specific data (friends, followers, etc) on their behalf.  

## REST API
### GET https://api.proxibase.com/schema/<tableName>

Returns a table's schema

### _id fields
Every proxibase record has a an immutable _id field that is unique within proxiabse. _ids have this form, with dates and times represented in UTC: 

    tabl.yymmdd.scnds.mil.random

meaning

    tableId.dateSince2000.secondsSinceMidnight.milliseconds.randomNumber

### GET /tableName
Returns the table's first 1000 records unsorted.

### GET /tableName/ids:id1,id2
Returns records with the specified ids. Note the initial ids:  Do quote or put spaces betweeen the id parameters themselves.

### GET /tableName/names:name1,name2
Returns records with the specified names. Note the initial names:  Do not quote or put spaces between the name parameters.  If the value of your name contains a comma, you cannot use this method to find it.  Use the do/find method in this case. 

### GET /tablename/[ids:...|names:.../]childTable1,childTable2|*
TEMPORARILY DISABLED

Returns all records specified with subdocuments for each child table specified. The wildcard * returns all child documents.  All fields from child documents are returned.  The query limit is applied both to the main document array and to each of its child arrays. Filters only apply to the main document, not to the document's children.

### GET /tablename/genid
Generates a valid id for the table with the UTC timestamp of the request.  Useful if you want to make posts to mulitple tables with the primary and foreign keys preassigned.

### GET parameters
Place GET query parameters at the end of the URL beginning with a ?. Separate parameters with &. Parameter ordering does not matter.

    ?find={"firstname":"John","lastname":{"$in":["Smith","Jones"]},"age":{"$lt":5}}
Returns the records in the table found using mongodb's [advanced query syntax](http://www.mongodb.org/display/DOCS/Advanced+Queries). The value of find must be parsable JSON. The rest of the url need not.

    ?fields=_id,name,created
Returns only the fields specified. _id is always returned. 

    ?limit=30
Returns only the first 30 records. Max 1000.

    ?lookups=true
TEMPORARILY DISABLED

Returns each document with its lookup fields fully populated. Default false.


### POST Rules
1. Set req.headers.content-type to 'application/json'
2. Make sure req.body is parsable json
3. Write the data for the new object inside a data element in the request body.  The new element can either be a simple object or an array of objects.
4. If you use an array, currently only one element is supported per post, but this may change in the future

ie

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

### POST /tablename/ids:id1
Updates the record with _id = id1 in tablename.  Non-system fields not inlucded in request.body.data or request.body.data[0] will not be modified.

### DELETE /tablename/ids:id1,id2
Deletes those records.

### DELETE /tablename/ids:*
Deletes all records in the table.

<a name="webmethods"></a>
## Custom Web Methods
[https://api.proxibase.com/do](https://api.proxibase.com/do)

Lists the web methods. POST to /do/methodName executes a method passing in the full request and response objects. The request body must be in JSON format. 

### POST /do/echo
Returns request.body

### POST /do/find
Is a way to do a GET on any table in the system, but with the paramters in the request body rather than on the query string. find expects request.body to contain JSON of this form:

    {
      "table": "tableName",
      "ids": ["_id1", "_id2"],
      "names": ["name1", "name2"],
      "fields": ["field1","field2"],
      "find": {"name":"name1"},
      "children": ["childTable1","childTable2"], // temporarily disabled
      "lookups": true, // temporarily disabled
      "limit": 25
    }

The table property is required.  All others are optional. The value of the find property is passed through to mongodb unmodified, so it can be used to specify any clauses that mongodb supports, including sorting, offset, etc.  See mongodb's [advanced query syntax](http://www.mongodb.org/display/DOCS/Advanced+Queries) for details. This may present a security problem, so will likely be removed once the public query syntax becomes more full-featured.

### POST /do/touch
Updates every record in a table.  Usefull when you need to re-run triggers on all records

    {
      "table": "tableName",     // required
      "preserveModified, true   // optional, default true, if false the method will update the modified date
    }


## Wiki
* (proxibase/wiki/)

## Todo
### Bugs
* GET /data/tablename,foo

### Authentication
* Validate user email
* Recover lost password workflow
* Create user with oauth workflow
* Oauth tests for Facebook and Google

### Permissions
* User permission checking API
* User permission setting API

### Rate limiting
* Map users to accounts
* Accrue user requests to acconts
* Rate limit gets
* Rate limit posts
* Lock / unlock account

### Website
* Read-only browse UI over tables
* User profile update UI
* My Candi UI

### Rest
* get: lookups
* get: field lists for lookups
* get: children
* get: fields lists for children
* get: outer joins
* get: child counts
* get: table.childtable.childtable...
* get: singleton get
* post: insert array
* saveAPI: convert to mongoskin

### Misc
* rationalize version migration into a command-linable pipeline
* do version migration in place?

