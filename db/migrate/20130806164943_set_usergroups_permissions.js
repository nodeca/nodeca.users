'use strict';


module.exports.up = async function (N) {
  let usergroupStore = N.settings.getStore('usergroup');

  // add usergroup settings for admin

  let adminGroupId = await N.models.users.UserGroup.findIdByName('administrators');

  await usergroupStore.set({
    // admin-specific settings
    can_access_acp:                { value: true },
    can_delete_infractions:        { value: true },
    can_see_deleted_users:         { value: true },
    can_hellban:                   { value: true },
    can_see_hellbanned:            { value: true },
    can_see_infractions:           { value: true },
    can_see_ip:                    { value: true },
    can_add_mod_notes:             { value: true },
    can_delete_mod_notes:          { value: true },
    cannot_receive_infractions:    { value: true },
    cannot_be_ignored:             { value: true },
    users_mod_can_add_infractions: { value: true },
    users_mod_can_delete_media:    { value: true },

    // same as members
    can_edit_profile:       { value: true },
    can_receive_email:      { value: true },
    can_report_abuse:       { value: true },
    can_create_dialogs:     { value: true },
    can_use_dialogs:        { value: true },
    can_vote:               { value: true },
    users_can_upload_media: { value: true }
  }, { usergroup_id: adminGroupId });

  // add usergroup settings for member

  let memberGroupId = await N.models.users.UserGroup.findIdByName('members');

  await usergroupStore.set({
    can_edit_profile:       { value: true },
    can_receive_email:      { value: true },
    can_report_abuse:       { value: true },
    can_create_dialogs:     { value: true },
    can_use_dialogs:        { value: true },
    can_vote:               { value: true },
    users_can_upload_media: { value: true }
  }, { usergroup_id: memberGroupId });

  // add usergroup settings for violators
  //
  // note: it is a modifier group added to users in addition to their
  //       existing usergroups, thus we should turn "force" flag on

  let violatorsGroupId = await N.models.users.UserGroup.findIdByName('violators');

  await usergroupStore.set({
    can_edit_profile:       { value: false, force: true },
    can_report_abuse:       { value: false, force: true },
    can_vote:               { value: false, force: true },
    users_can_upload_media: { value: false, force: true }
  }, { usergroup_id: violatorsGroupId });
};
