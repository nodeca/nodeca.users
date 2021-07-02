// Get a message from the database, rebuild it and write it back to the database
//
'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {

  N.wire.on(apiPath, async function rebuild_message(ids) {
    if (!Array.isArray(ids)) ids = [ ids ];

    let posts = await N.models.users.DlgMessage.find()
                          .where('_id').in(ids)
                          .lean(true);

    let dialogs_by_id = _.keyBy(
      await N.models.users.Dialog.find()
                .where('_id').in(_.uniq(posts.map(x => x.parent).map(String)))
                .lean(true),
      '_id'
    );

    let msg_bulk = N.models.users.DlgMessage.collection.initializeUnorderedBulkOp();
    let dlg_bulk = N.models.users.Dialog.collection.initializeUnorderedBulkOp();

    await Promise.all(posts.map(async post => {
      let params = await N.models.core.MessageParams.getParams(post.params_ref);
      let result = await N.parser.md2html({
        text:         post.md,
        options:      params,
        imports:      post.imports,
        import_users: post.import_users
      });

      let updateData = {
        $set: {
          html: result.html
        }
      };

      let needsUpdate = result.html !== post.html;

      for (let field of [ 'imports', 'import_users' ]) {
        if (result[field] && result[field].length !== 0) {
          updateData.$set[field] = result[field];
          needsUpdate = needsUpdate || JSON.stringify(result[field]) !== JSON.stringify(post[field]);
        } else {
          updateData.$unset = updateData.$unset || {};
          updateData.$unset[field] = true;
          needsUpdate = needsUpdate || typeof post[field] !== 'undefined';
        }
      }

      if (needsUpdate) {
        msg_bulk.find({ _id: post._id }).update(updateData);
      }

      //
      // If it's the last message in the dialog, rebuild preview as well
      //
      let dialog = dialogs_by_id[post.parent];

      if (dialog?.cache && String(dialog.cache.last_message) === String(post._id)) {
        let preview_data = await N.parser.md2preview({
          text: post.md,
          limit: 500,
          link2text: true
        });

        let updateData = {
          $set: {
            cache: {
              last_message: post._id,
              last_user:    post.user,
              last_ts:      post.ts,
              is_reply:     String(post.user) === String(dialog.user),
              preview:      preview_data.preview
            }
          }
        };

        if (!_.isEqual(updateData.$set.cache, dialog.cache)) {
          await dlg_bulk.find({ _id: post.parent }).update(updateData);
        }
      }
    }));

    if (msg_bulk.length > 0) await msg_bulk.execute();
    if (dlg_bulk.length > 0) await dlg_bulk.execute();
  });
};
