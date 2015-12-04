![](diagram.png)

### internal:users.notify

env:

- src (ObjectId) - content _id
- to (ObjectId|[ObjectId]) - recipient id, could be array
- type (String) - notification type

### internal:users.notify.deliver

env:

- src (ObjectId) - content _id
- to ([ObjectId]) - users _id array
- type (String) - notification type
- messages (Object) - key is user _id
  - subject
  - text
  - url
  - unsubscribe
