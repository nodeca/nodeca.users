// Change note for a user
//
'use strict';

const _ = require('lodash');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'number', required: true },
    txt:      { type: 'string', required: true }
  });


  N.wire.on(apiPath, function check_permissions(env) {
    if (env.user_info.is_guest) return N.io.NOT_FOUND;
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

    let parseOptions = {
      code:           true,
      emoji:          true,
      emphasis:       true,
      heading:        true,
      hr:             true,
      image:          true,
      link:           true,
      link_to_title:  true,
      list:           true,
      quote:          true,
      quote_collapse: true,
      sub:            true,
      sup:            true
    };

    env.data.parse_result = yield N.parser.md2html({
      text:        env.params.txt,
      options:     parseOptions,
      attachments: [],
      user_info:   env.user_info
    });

    env.data.usernote = yield N.models.users.UserNote.findOneAndUpdate({
      from: env.user_info.user_id,
      to:   env.data.target_user._id
    }, {
      $set: {
        md:      env.params.txt,
        html:    env.data.parse_result.html
      },
      $inc: {
        version: 1
      }
    }, { 'new': true, upsert: true });
  });


  // Expose data to re-render template on the server
  //
  N.wire.on(apiPath, function add_render_data(env) {
    env.data.users = env.data.users || [];
    env.data.users.push(env.data.target_user._id);

    _.set(env.res, 'blocks.usernote', {
      md:      env.data.usernote.md,
      html:    env.data.usernote.html,
      version: env.data.usernote.version,
      user_id: env.data.target_user._id
    });
  });
};
