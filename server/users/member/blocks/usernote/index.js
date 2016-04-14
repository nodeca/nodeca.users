// Add notepad to user page
//
'use strict';


const _ = require('lodash');


module.exports = function (N) {

  N.wire.after('server:users.member', function* add_notepad(env) {
    if (env.user_info.is_guest) return;

    let note = yield N.models.users.UserNote.findOne({
      from: env.user_info.user_id,
      to:   env.data.user._id
    });

    if (note) {
      _.set(env.res, 'blocks.usernote', { html: note.html });
    } else {
      // adding empty object, 'cause otherwise this block
      // won't be inserted into the profile page
      _.set(env.res, 'blocks.usernote', {});
    }
  });
};
