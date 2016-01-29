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

  N.wire.on('internal:common.content.attachments', function* get_attachments(data) {
    data.attachments = data.attachments || {};

    let ids = data.ids.map(String).filter(id => !data.attachments[id]);

    if (!ids.length) return;

    let result = yield N.models.users.MediaInfo
                          .where('media_id').in(ids)
                          .where('type').in(N.models.users.MediaInfo.types.LIST_VISIBLE)
                          .lean(true);

    result.forEach(attach => {
      data.attachments[attach.media_id] = {
        type: attach.type,
        file_name: attach.file_name,
        image_sizes: attach.image_sizes
      };
    });
  });
};
