// Add notepad to user page
//
'use strict';


const _ = require('lodash');


module.exports = function (N) {

  N.wire.after('server:users.member', async function add_notepad(env) {
    if (!env.user_info.is_member) return;

    let usernote = await N.models.users.UserNote.findOne({
      from: env.user_info.user_id,
      to:   env.data.user._id
    });

    let template_params = {
      user_id: env.data.user._id
    };

    if (usernote) {
      template_params.html    = usernote.html;
      template_params.md      = usernote.md;
      template_params.version = usernote.version;
    }

    _.set(env.res, 'blocks.usernote', template_params);
  });
};
