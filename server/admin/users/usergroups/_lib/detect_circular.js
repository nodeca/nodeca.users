// Checks if inheritance list of the given group is not circular.
// Resolves with null on ok, or ObjectID of the group where circularity found.
//


'use strict';


const _  = require('lodash');
const co = require('co');


module.exports = co.wrap(function* detectCircular(N, groupId, parentId) {
  // No parent - skip.
  if (!parentId) return null;

  let groups = yield N.models.users.UserGroup.find().select('_id parent_group');

  let descendants = [ String(groupId) ];

  // Returns `null` if no circular dependency found
  // or group id of first detected circular dependency
  function checkGroup(groupId) {
    let group = _.find(groups, g => String(g._id) === String(groupId));

    if (descendants.indexOf(groupId) >= 0) {
      return groupId;
    }

    descendants.push(groupId);

    if (group.parent_group) {
      return checkGroup(group.parent_group.toString());
    }

    return null;
  }

  return checkGroup(String(parentId));
});
