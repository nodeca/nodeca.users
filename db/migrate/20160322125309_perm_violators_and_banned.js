// Add usergroup settings for violators and banned
//
'use strict';


const co = require('co');


module.exports.up = co.wrap(function* (N) {
  let usergroupStore = N.settings.getStore('usergroup');


  let violators = yield N.models.users.UserGroup.findOne({ short_name: 'violators' });

  yield usergroupStore.set({
    users_can_upload_media: { value: false, force: true },
    can_vote: { value: false, force: true },
    can_report_abuse: { value: false, force: true }
  }, { usergroup_id: violators._id });


  let banned = yield N.models.users.UserGroup.findOne({ short_name: 'banned' });

  yield usergroupStore.set({
    users_can_upload_media: { value: false, force: true },
    can_vote: { value: false, force: true },
    can_report_abuse: { value: false, force: true }
  }, { usergroup_id: banned._id });


  // Recalculate store settings of all groups.
  //
  yield usergroupStore.updateInherited();
});
