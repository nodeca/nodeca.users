// Check if nick is not occupied
//
"use strict";


var _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    nick: {
      type: "string",
      minLength: 1,
      required: true
    }
  });

  // Request handler
  //
  N.wire.on(apiPath, function (env, callback) {

    N.models.users.User.findOne({ 'nick': env.params.nick}).setOptions({ lean: true })
        .exec(function (err, doc) {
      if (err) {
        callback(err);
        return;
      }
      if (!_.isEmpty(doc)) {
        callback({
          code: N.io.BAD_REQUEST,
          data: { nick: env.helpers.t(env.method + '.nick_busy')}
        });
        return;
      }
      callback();
    });
  });
};
