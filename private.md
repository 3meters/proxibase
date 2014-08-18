# Priate and Secret Places Tech Spec

## User Model
Places (aka patches) can have three scopes of visibility: public, private, or hidden.  Public is what we have now and is the default.  Private means that a patch (or some subset of its fields) is generally visible in all lists that display places, but that that all content entities linked to that patch are invisible, unless the owner of a patch has specifically granted access to that user.  Secret places are not visible any any of the standard public lists, particlaryly nearby.  Nor may content posted to that place be seen by non-invited users.

This spec discusses various technical options for implemeting private and secret places.

Tools
=====
  * systemCollection  (_base.js, set on action, install, session, task)
  * ownerAccess (implemented in _base, set on user, document, session)
  * before read trigger:  Edit the query before it is executed
  * after read trigger: Handle the results after they have been read from the db, but before they are returned to the caller.
  * Custom field lists (Ipmlented in user as a read trigger but not generallized:  some fields availabe publically (name, picture), others are ownerAccess.
  * Master-detail query engines:  We have two!  safeFind links and getEntitiesForEntity.
  * Triggers on reads and writes of links
  * fields:  currently all entities have a _place field which is set by convention by the client, and could be use to quickly check permissions.

Current Link Permissions
========================
In link.js we have couple of rules coded now.  1) You cannot create a link from an entity that you do not own.  Once a user creates a link, we the the owner to the owner of the _to for links of type content, or to the owner of the _from for non-conent links.  Only the owner can remove (this is currently enfoced before any of the code in link.js has had a chance to run -- exceptions would go into _base.js)


Joining a Place:
================
Currently any user can watch a pubic place.  We can can either stick with watch links, possibly using the enabled bit, or create a new link type: join.  For now we will stick with watch.  When users invite a user to watch a place, we create a message entity with the invitation, then we create a special link between the invited user and the message of type 'share'.  In the client, if a user follows a share link to a message, the client creates a watch link from the accepting user to the shared entity.

Scenarios:
==========
Requesting to join a private place:

Declining a request to join a private place:

Accept a request to join a private place:

Kicking a user out of a private or secret place:

Inviting a user to join a private or secret place:

Declining an invitation to join a private or secret place:

Accepting an invitation to join a pivate or secret place:

Visbility of messages (and potentially other child entities)

Ideas:
==========
Convert messages to an ownerAccess collection.  Modify either getEntitiesforEntity or getEntities or both to run subQueries asAdmin once users have been identified as having permissions.  
