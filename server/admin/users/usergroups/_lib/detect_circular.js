// Checks if inheritance list of the given group is not circular.
// Returns (via a callback) ObjectID of the group whree the circularity appears.
//


'use strict';


var _ = require('lodash');


module.exports = function detectCircular(groupId, parentId, callback) {
  N.models.users.UserGroup
      .find()
      .select('_id short_name parent_group')
      .setOptions({ lean: true })
      .exec(function (err, groups) {

    if (err) {
      callback(err);
      return;
    }

    var descendants = [ String(groupId) ];

    function checkGroup(groupId) {
      var group    = _.find(groups, function (g) { return g._id.equals(groupId); })
        , stringId = String(groupId);

      if (_.contains(descendants, stringId)) {
        return groupId;
      }

      descendants.push(stringId);

      if (group.parent_group) {
        return checkGroup(group.parent_group);
      } else {
        return null;
      }
    }

    callback(null, checkGroup(parentId));
  });
};
