'use strict';


exports.up = function (N, callback) {
  var usergroup = new N.models.users.UserGroup({
    short_name:   'unconfirmed_email'
  , is_protected: true
  });

  usergroup.save(callback);
};
