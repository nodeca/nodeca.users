// Check if nick is not occupied.


'use strict';


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    nick: {
      type: 'string'
    , required: true
    , minLength: 1
    }
  });

  N.wire.on(apiPath, function (env, callback) {
    N.models.users.User
        .findOne({ 'nick': env.params.nick })
        .select('_id')
        .setOptions({ lean: true })
        .exec(function (err, user) {

      if (err) {
        callback(err);
        return;
      }

      env.response.data.nick_is_free = _.isEmpty(user);
      callback();
    });
  });
};
