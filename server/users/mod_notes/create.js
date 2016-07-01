// Create moderator's note for user
//
'use strict';


const parse_options = require('./_parse_options');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true },
    txt:      { type: 'string', required: true }
  });


  // Check auth and permissions
  //
  N.wire.before(apiPath, function* check_permissions(env) {
    if (env.user_info.is_guest) throw N.io.NOT_FOUND;

    let can_add_mod_notes = yield env.extras.settings.fetch('can_add_mod_notes');

    if (!can_add_mod_notes) throw N.io.NOT_FOUND;
  });


  // Fetch user
  //
  N.wire.before(apiPath, function* fetch_user(env) {
    env.data.user = yield N.models.users.User
                              .findOne({ hid: env.params.user_hid })
                              .lean(true);

    if (!env.data.user) throw N.io.BAD_REQUEST;
  });


  // Save note
  //
  N.wire.on(apiPath, function* save_note(env) {
    if (!env.params.txt.trim()) {
      // If text is empty, this exception should never appear in practice
      throw N.io.BAD_REQUEST;
    }

    let parse_result = yield N.parser.md2html({
      text:        env.params.txt,
      options:     parse_options,
      attachments: [],
      user_info:   env.user_info
    });

    let note = new N.models.users.ModeratorNote({
      from: env.user_info.user_id,
      to:   env.data.user._id,
      md:   env.params.txt,
      html: parse_result.html
    });

    yield note.save();
  });
};
