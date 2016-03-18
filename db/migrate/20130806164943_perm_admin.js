'use strict';


const co = require('co');


module.exports.up = co.wrap(function* (N) {
  let usergroupStore = N.settings.getStore('usergroup');

  // add usergroup settings for admin

  let adminGroup = yield N.models.users.UserGroup.findOne({ short_name: 'administrators' });

  yield usergroupStore.set({
    can_access_acp: { value: true },
    can_see_hellbanned: { value: true },
    can_see_deleted_users: { value: true },
    can_see_ip: { value: true },
    can_receive_infractions: { value: false },
    can_see_infractions: { value: true },
    users_mod_can_add_infractions: { value: true }
  }, { usergroup_id: adminGroup._id });

  // Recalculate store settings of all groups.
  yield usergroupStore.updateInherited();
});
