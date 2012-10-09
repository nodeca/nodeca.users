"use strict";

/*global nodeca*/

var UserGroup = nodeca.models.users.UserGroup;

// Validate input parameters
//
var params_schema = {
  short_name: {
    type: 'string',
    required: true
  }
};

nodeca.validate(params_schema);


/**
 * admin.usergroups.delete(params, callback) -> Void
 *
 * ##### Params
 * - short_name(String):        group id
 *
 * Delete user group
 *
 **/
module.exports = function (params, next) {
  UserGroup.findOne({short_name: params.short_name}).exec(function(err, group) {
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
