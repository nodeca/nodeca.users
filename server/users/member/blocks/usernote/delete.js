// Remove a note
//
'use strict';

const _ = require('lodash');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'number', required: true }
  });


  N.wire.on(apiPath, function check_permissions(env) {
    if (!env.user_info.is_member) return N.io.NOT_FOUND;
  });


  N.wire.on(apiPath, async function check_target_user(env) {
    env.data.target_user = await N.models.users.User.findOne({ hid: env.params.user_hid });

    // user not found
    if (!env.data.target_user) throw N.io.BAD_REQUEST;
  });


  N.wire.on(apiPath, async function delete_note(env) {
    await N.models.users.UserNote.deleteOne({
      from: env.user_info.user_id,
      to:   env.data.target_user._id
    });
  });


  // Expose data to re-render template on the server
  //
  N.wire.on(apiPath, function add_render_data(env) {
    env.data.users = env.data.users || [];
    env.data.users.push(env.data.target_user._id);

    _.set(env.res, 'blocks.usernote', {
      user_id: env.data.target_user._id
    });
  });
};
