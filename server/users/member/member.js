"use strict";


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    id: {
      type: "integer",
      minimum: 1,
      required: true
    }
  });

  N.wire.on(apiPath, function (env, callback) {
    //FIXME implement me
    callback();
  });
};