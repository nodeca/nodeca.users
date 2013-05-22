'use strict';


exports.up = function (N, callback) {
  N.models.users.UserGroup.findOneAndUpdate(
    { short_name: 'unconfirmed_email' }
  , { short_name: 'validating' }
  , callback
  );
};
