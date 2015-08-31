// Get attachment attributes
//
// Input:
//  - data.ids (Array)
//
// Output:
//  - data.result (Object)
//    <ObjectId>:
//      - type      (Number)
//      - file_name (String)
//

'use strict';


module.exports = function (N) {

  N.wire.on('internal:common.content.attachments', function get_attachments(data, callback) {
    data.attachments = data.attachments || {};

    var ids = data.ids.map(String).filter(function (id) {
      return !data.attachments[id];
    });

    if (!ids.length) {
      callback();
      return;
    }

    N.models.users.MediaInfo
        .where('media_id').in(ids)
        .where('type').in(N.models.users.MediaInfo.types.LIST_VISIBLE)
        .lean(true)
        .exec(function (err, result) {

      if (err) {
        callback(err);
        return;
      }

      result.forEach(function (attach) {
        data.attachments[attach.media_id] = {
          type: attach.type,
          file_name: attach.file_name,
          image_sizes: attach.image_sizes
        };
      });

      callback();
    });
  });
};
