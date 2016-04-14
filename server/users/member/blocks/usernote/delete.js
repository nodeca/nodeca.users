// Remove a note
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'number', required: true }
  });


  N.wire.on(apiPath, function check_permissions(env) {
    if (env.user_info.is_guest) return N.io.NOT_FOUND;
  });


  N.wire.on(apiPath, function* check_target_user(env) {
    env.data.target_user = yield N.models.users.User.findOne({ hid: env.params.user_hid });

    // user not found
    if (!env.data.target_user) throw N.io.BAD_REQUEST;
  });


  N.wire.on(apiPath, function* delete_note(env) {
    yield N.models.users.UserNote.remove({
      from: env.user_info.user_id,
      to:   env.data.target_user._id
    });
  });
};
