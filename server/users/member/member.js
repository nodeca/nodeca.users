'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    hid: {
      type: 'integer',
      minimum: 1,
      required: true
    }
  });

  N.wire.on(apiPath, function (env, callback) {
    //FIXME implement me
    env.res.member_hid = env.params.hid;
    callback();
  });
};