
'use strict';


N.wire.before('admin.users.members.edit:submit', function get_usergroups(data) {
  data.fields.usergroups = data.$this.serializeArray()
                               .filter(obj => obj.name === 'usergroups')
                               .map(obj => obj.value);
});
