// Get raw note for the editor
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'number', required: true }
  });


  N.wire.on(apiPath, function check_permissions(env) {
    if (env.user_info.is_guest) return N.io.NOT_FOUND;
  });


  N.wire.on(apiPath, function* get_parse_options(env) {
    let options = yield N.settings.getByCategory(
      'forum_markup',
      { usergroup_ids: env.user_info.usergroups },
      { alias: true }
    );

    options.attachment      = false;
    options.footnote        = false;
    options.link_to_snippet = false;
    options.spoiler         = false;
    options.table           = false;

    env.data.parse_options = options;
  });


  N.wire.on(apiPath, function* check_target_user(env) {
    let user = yield N.models.users.User.findOne({ hid: env.params.user_hid });

    // user not found
    if (!user) throw N.io.BAD_REQUEST;

    env.data.user = user;
  });


  N.wire.on(apiPath, function* get_note(env) {
    let note = yield N.models.users.UserNote.findOne({
      from: env.user_info.user_id,
      to:   env.data.user._id
    });

    env.res.txt           = note ? note.md : '';
    env.res.version       = note ? note.version : 0;
    env.res.parse_options = env.data.parse_options;
  });
};
