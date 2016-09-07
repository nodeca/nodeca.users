
'use strict';


N.wire.before('admin.users.members.edit:submit', function get_usergroups(data) {
  let usergroups = [];

  Object.keys(data.fields).forEach(name => {
    let m = name.match(/^usergroup-([0-9a-f]{24})$/);

    if (m) {
      usergroups.push(m[1]);
      delete data.fields[name];
    }
  });

  data.fields.usergroups = usergroups;
});
