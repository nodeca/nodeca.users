// Get a message from the database, rebuild it and write it back to the database
//
'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, function* rebuild_message(id) {
    let post = yield N.models.users.DlgMessage.findById(id);

    if (!post) return;

    let params = yield N.models.core.MessageParams.getParams(post.params_ref);
    let result = yield N.parser.md2html({
      text:         post.md,
      attachments:  post.attach,
      options:      params,
      imports:      post.imports,
      import_users: post.import_users
    });

    let updateData = {
      tail: result.tail,
      html: result.html
    };

    [ 'imports', 'import_users' ].forEach(field => {
      if (!_.isEmpty(result[field])) {
        updateData[field] = result[field];
      } else {
        updateData.$unset = updateData.$unset || {};
        updateData.$unset[field] = true;
      }
    });

    yield N.models.users.DlgMessage.update({ _id: post._id }, updateData);

    //
    // If it's the last message in the dialog, rebuild preview as well
    //
    let dialog = yield N.models.users.Dialog.findById(post.parent);

    if (dialog && dialog.cache && String(dialog.cache.last_message) === String(post._id)) {
      let preview_data = yield N.parser.md2preview({
        text: post.md,
        limit: 500,
        link2text: true
      });

      yield N.models.users.Dialog.update({ _id: post.parent }, {
        $set: {
          cache: {
            last_message: post._id,
            last_user:    post.user,
            last_ts:      post.ts,
            is_reply:     String(post.user) === String(dialog.user),
            preview:      preview_data.preview
          }
        }
      });
    }
  });
};
