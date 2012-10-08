"use strict";

/*global nodeca, _*/

var UserGroup = nodeca.models.users.UserGroup;

var usergroup_schema = nodeca.config.setting_schemas['usergroup'];

// Validate input parameters
//
var params_schema = {
  _id: {
    type: 'string',
    required: true
  }
};

nodeca.validate(params_schema);


/**
 * admin.usergroups.delete(params, callback) -> Void
 *
 * ##### Params
 * - _id(String):        group id
 *
 * Delete user group
 *
 **/
module.exports = function (params, next) {
  UserGroup.findOne({_id: params.group_id}).exec(function(err, group) {
    if (err) {
      next(err);
      return;
    }
    if (!group) {
      next({ statusCode: nodeca.io.NOT_FOUND });
      return;
    }
    group.remove(next);
  });
};
