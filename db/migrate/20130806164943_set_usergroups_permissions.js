'use strict';


const co = require('bluebird-co').co;


module.exports.up = co.wrap(function* (N) {
  let usergroupStore = N.settings.getStore('usergroup');

  // add usergroup settings for admin

  let adminGroup = yield N.models.users.UserGroup.findOne({ short_name: 'administrators' });

  yield usergroupStore.set({
    // admin-specific settings
    can_access_acp:                { value: true },
    can_delete_infractions:        { value: true },
    can_see_deleted_users:         { value: true },
    can_see_hellbanned:            { value: true },
    can_see_infractions:           { value: true },
    can_see_ip:                    { value: true },
    cannot_receive_infractions:    { value: true },
    users_mod_can_add_infractions: { value: true },

    // same as members
    can_receive_email:      { value: true },
    can_report_abuse:       { value: true },
    can_send_messages:      { value: true },
    can_use_messages:       { value: true },
    can_vote:               { value: true },
    users_can_upload_media: { value: true }
  }, { usergroup_id: adminGroup._id });

  // add usergroup settings for member

  let memberGroup = yield N.models.users.UserGroup.findOne({ short_name: 'members' });

  yield usergroupStore.set({
    can_receive_email:      { value: true },
    can_report_abuse:       { value: true },
    can_send_messages:      { value: true },
    can_use_messages:       { value: true },
    can_vote:               { value: true },
    users_can_upload_media: { value: true }
  }, { usergroup_id: memberGroup._id });

  // add usergroup settings for violators
  //
  // note: it is a modifier group added to users in addition to their
  //       existing usergroups, thus we should turn "force" flag on

  let violatorsGroup = yield N.models.users.UserGroup.findOne({ short_name: 'violators' });

  yield usergroupStore.set({
    can_report_abuse:       { value: false, force: true },
    can_vote:               { value: false, force: true },
    users_can_upload_media: { value: false, force: true }
  }, { usergroup_id: violatorsGroup._id });

  // Recalculate store settings of all groups.
  yield usergroupStore.updateInherited();
});
