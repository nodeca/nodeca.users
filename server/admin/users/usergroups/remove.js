"use strict";

/*global nodeca, _*/

var UserGroup = nodeca.models.users.UserGroup;
var User = nodeca.models.users.User;

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
 * admin.usergroups.remove(params, callback) -> Void
 *
 * ##### Params
 * - short_name(String):        group id
 *
 * Remove user group
 *
 **/
module.exports = function (params, next) {
  var env = this;
  UserGroup.findOne({short_name: params.short_name}).exec(function(err, group) {
    if (err) {
      next(err);
      return;
    }

    // not found
    if (!group) {
      next(nodeca.io.NOT_FOUND);
      return;
    }

    // group protected
    if (group.is_protected) {
      next({
        code: nodeca.io.BAD_REQUEST,
        data: {
          common: env.helpers.t('admin.users.usergroups.remove.error.protected')
        }
      });
      return;
    }

    
    // find users associated with group
    User.find({ usergroups: group._id })
        .exec(function(err, users) {
      if (err) {
        next(err);
        return;
      }
      if (!_.isEmpty(users)) {
        next({
          code: nodeca.io.BAD_REQUEST,
          data: {
            common: env.helpers.t('admin.users.usergroups.remove.error.not_empty')
          }
        });
        return;
      }
      group.remove(next);
    });
  });
};
