// Change note for a user
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'number', required: true },
    txt:      { type: 'string', required: true }
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
    env.data.target_user = yield N.models.users.User.findOne({ hid: env.params.user_hid });

    // user which profile the note is saved on is not found,
    // this should never happen if user is using the site in a browser
    if (!env.data.target_user) throw N.io.BAD_REQUEST;
  });


  N.wire.on(apiPath, function* set_note(env) {
    if (!env.params.txt.trim()) {
      // if text is empty, client should call `delete` instead,
      // so this exception should never appear in practice
      throw {
        code: N.io.CLIENT_ERROR,
        message: env.t('err_text_is_empty')
      };
    }

    let parse_result = yield N.parse({
      text:        env.params.txt,
      options:     env.data.parse_options,
      attachments: [],
      user_info:   env.user_info
    });

    yield N.models.users.UserNote.update({
      from: env.user_info.user_id,
      to:   env.data.target_user._id
    }, {
      $set: {
        md:      env.params.txt,
        html:    parse_result.html
      },
      $inc: {
        version: 1
      }
    }, { upsert: true });
  });
};
