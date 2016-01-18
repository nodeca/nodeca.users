'use strict';


const co = require('co');


module.exports.up = co.wrap(function* (N) {
  let usergroupStore = N.settings.getStore('usergroup');

  // add usergroup settings for administrators, members
  let groups = yield N.models.users.UserGroup.find({ short_name: { $in: [ 'administrators', 'members' ] } });

  for (let i = 0; i < groups.length; i++) {
    let group = groups[i];

    yield usergroupStore.set({
      users_can_upload_media: { value: true }
    }, { usergroup_id: group._id });
  }

  // Recalculate store settings of all groups.
  yield usergroupStore.updateInherited();
});
