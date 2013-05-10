// Checks if inheritance list of the given group is not circular.
// Returns (via a callback) null on ok, or ObjectID of the group where circularity found.
//


'use strict';


var _ = require('lodash');


module.exports = function detectCircular(groupId, parentId, callback) {
  if (!parentId) {
    // No parent - skip.
    callback();
    return;
  }

  N.models.users.UserGroup
      .find()
      .select('_id parent_group')
      .exec(function (err, groups) {

    if (err) {
      callback(err);
      return;
    }

    var descendants = [ String(groupId) ];

    // Returns `null` if no circular dependency found
    // or group id of first detected circular dependency
    function checkGroup(groupId) {
      var group = _.find(groups, { id: groupId });

      if (_.contains(descendants, groupId)) {
        return groupId;
      }

      descendants.push(groupId);

      if (group.parent_group) {
        return checkGroup(group.parent_group.toString());
      } else {
        return null;
      }
    }

    callback(null, checkGroup(String(parentId)));
  });
};
