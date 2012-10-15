# Proxibase
Proxibase is the backing service for 3meters aircandi and related services

Web: https://www.aircandi.com

API: https://api.aircandi.com

## Quick Reference

Users sign in via :

    path: /auth/signin
    method: post
    body: {
      user: {
        email: (case-insensitive)
        password: password  (case-sensitive)
      }
    }

Once signed in, pass user credentials on the URL like so:

   ?user=<user._id>&session=<session.key>

Find parameters:

    path: /do/find,
    method: post,
    body: {
      table|collection: collection1,
      ids: [_id1, _id2],
      names: [name1, name2],  // case-insensitive, all other finds are case-sensitive
      fields: [field1,field2],
      find: {name:"name1"},  // passthrough to mongo selector
      children: ["childTable1","childTable2"], // temporarily disabled
      lookups: true, // temporarily disabled
      limit: 1000,
      skip: 200,
      sort: {field1:1, field2:-1},
      count: true,
      countBy:  field1
    }


## Users and Admins
Each user account has a role.  The only valid roles are 'user', the default, and 'admin'.  When the server starts it checks for a user with _id 00000.000000.00000.000.00000.  If it does not exist the server creates the user with 

    {
      _id: '00000.000000.00000.000.00000',
      email: 'admin',
      name: 'admin',
      role: 'admin',
      password: 'admin'
    }
    
Users or tests can log in with these credentials to perform administrative tasks.

With a few exeptions, admins can perform any operation on the server that would be prevented by permissions.  Users, in general, can read everything, write records to most tables, and can update records that they own.  Users cannot update or delete records owned by other users.

### Creating New Users
See the guidelines for posting below, but the api is 

    path: /user/create
    method: post
    body:  {data: {
      email: <email>
      password: <password>
    }}

all other fields are optional.  Note that user issuing this call does not need to be signed in.  We have a TODO to add a captcha feature to prevent robots from abusing this API.  On successful account creation, the service signs in the user, creating a new session object.  The complete user and session object are returned to the caller.

Note that on success this call sets return status code to 200, not 201 and one might expect.  This is due to doubleing us the signin call.  

## AUTHENTICATION
Users can be authenticated locally with a password, or by a oauth provider such as Facebook, Twitter, or Google.  Their authentication source is stored in the users.authSource field which is required.  Valid values may be found in util.statics.authSources.  The users table now requires either a password or valid oauth credentials to be stored before a user record to be created, with the exception of the /user/create api described above.  User emails must be unique.

### Local
If a new user is created with a password we assume the authSource is local.  We validate that the password is sufficiently strong before saving, and we save a one-way hash of the password the user entered.  See the users schema for the password rules and hash methods.

Users sign in via :

    path: /auth/signin
    method: post
    body: {
      user: {
        email: (case-insensitive)
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

    path: /auth/signout
    method: get

    with user and session passed in as query parameters

### Passwords

User passwords cannot be updated via the ordinary rest methods, only via the change password api:

    path: /user/changepw  
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

    path: /auth/signin/facebook|twitter|google
    method: get

session management after a sucessful authentication is the same as with local authentication.  If the user authenticates via an oauth provider, we store their provider credentials and user key, allowing us to access their picture and other provider specific data (friends, followers, etc) on their behalf.  

## REST API
### GET https://api.aircandi.com/schema/<tableName>

Returns a table's schema

### _id fields
Every proxibase record has a an immutable _id field that is unique within proxiabse. _ids have this form, with dates and times represented in UTC: 

    tabl.yymmdd.scnds.mil.random

meaning

    tableId.dateSince2000.secondsSinceMidnight.milliseconds.randomNumber

### GET /data/tableName
Returns the table's first 1000 records unsorted.

### GET /data/tableName/ids:id1,id2
Returns records with the specified ids. Note the initial ids:  Do quote or put spaces betweeen the id parameters themselves.

### GET /data/tableName/names:name1,name2
Returns records with the specified names. Note the initial names:  Do not quote or put spaces between the name parameters.  If the value of your name contains a comma, you cannot use this method to find it.  Use the do/find method in this case. 

### GET /data/tablename/[ids:...|names:.../]childTable1,childTable2|*
TEMPORARILY DISABLED

Returns all records specified with subdocuments for each child table specified. The wildcard * returns all child documents.  All fields from child documents are returned.  The query limit is applied both to the main document array and to each of its child arrays. Filters only apply to the main document, not to the document's children.

### GET /data/tablename/genid
Generates a valid id for the table with the UTC timestamp of the request.  Useful if you want to make posts to mulitple tables with the primary and foreign keys preassigned.

### GET parameters
Place GET query parameters at the end of the URL beginning with a ?. Separate parameters with &. Parameter ordering does not matter.

    ?find={"firstname":"John","lastname":{"$in":["Smith","Jones"]},"age":{"$lt":5}}
Returns the records in the table found using mongodb's [advanced query syntax](http://www.mongodb.org/display/DOCS/Advanced+Queries). The value of find must be parsable JSON. The rest of the url need not.

    ?fields=_id,name,created
Returns only the fields specified. _id is always returned. 

    ?sort={"namelc":1, "age:-1"}
Returns sorted by name lower case ascending, age decending

    ?limit=30
Returns only the first 30 records. Max 1000.

    ?skip=1000
Skip the first 1000 records. Use in conjection with sort and limit to provide paging.

    ?count=ture
Only return the count of the collection, not any of the data.  Limit, skip, and field paramters are ignored.

    ?lookups=true
TEMPORARILY DISABLED

Returns each document with its lookup fields fully populated. Default false.


### POST Rules
1. Set req.headers.content-type to 'application/json'
2. Make sure req.body is parsable json
3. Write the data for the new object inside a data element in the request body.  The new element can either be a simple object or an array of objects.
4. You may put your updated elements inside an array, however currently only one element is supported per post

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

### POST /data/tablename
Inserts req.body.data or req.body.data[0] into the tablename table.  If a value for _id is specified it will be used, otherwise the server will generate a value for _id.  Only one record may be inserted per request. If you specifiy values for any of the system fields, those values will be stored.  If you do not the system will generates defaults for you.  The return value is all fields of the newly created record inside a data tag.  If you just want the _id back, include request.body.terse = true in your request.

### POST /data/tablename/ids:id1
Updates the record with _id = id1 in tablename.  Non-system fields not inlucded in request.body.data or request.body.data[0] will not be modified. The return value is all fields of the modified record inside a data tag.  If you just want the _id back, include request.body.terse = true in youir request.  

### DELETE /data/tablename/ids:id1,id2
Deletes those records.

### DELETE /data/tablename/ids:*
Deletes all records in the table (admins only)

<a name="webmethods"></a>
## Custom Web Methods
[https://api.aircandi.com/do](https://api.aircandi.com/do)

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

<a name="stats">
### Statistics
Site statistics are acceessed via 

    GET /stats

This will return a list of supported stats.  For each stat

    GET /stats/<stat>
  
will return a collection of the statistics.  These are ordinary monogodb collections.  In the database their names are prefixed by "stats_".  All the normal parameters to the rest GET API will work.  POST /do/find works too using the body param stat: <stat>. All statistic collections are static, and must be recomputed to be current. To recompute a statistic, add the parameter 

    ?refresh=true

Refreshing statitics requires admin credentials since the operation can be expensive


## Wiki
* (proxibase/wiki/)

## Todo

### Bugs

### Models
* Add schema checker to base.js
* Broken links: prevent or garbage collect
* Create user captcha

### Custom Methods
* Respect locked Entity on InsertEntity, UpdateEntity, DeleteEntity, InsertComment

### Tests
* Insert comments on others records

### Authentication
* Validate user email workflow
* Recover lost password workflow
* Create user with oauth workflow
* Oauth tests for Facebook and Google

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
* scrub old style errors from custom methods
* rationalize version migration into a command-linable pipeline
* do version migration in place?

