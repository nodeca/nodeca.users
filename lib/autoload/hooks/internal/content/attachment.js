// Get attachment attributes
//
// Input:
//  - data.id (ObjectId)
//
// Output:
//  - data.type      (Number)
//  - data.file_name (String)
//

'use strict';


module.exports = function (N) {

  N.wire.on('internal:common.content.attachment', function get_attachment(data, callback) {
    if (data.type) {
      callback();
      return;
    }

    N.models.users.MediaInfo
        .findOne({
          media_id: data.id,
          type: { $in: N.models.users.MediaInfo.types.LIST_VISIBLE }
        })
        .lean(true)
        .exec(function (err, res) {

      if (err) {
        callback(err);
        return;
      }

      data.type      = res.type;
      data.file_name = res.file_name;

      callback();
    });
  });
};
