// Used to track invalid login attempts for single IP.
// Maximum 5 attempts in 5 minutes.


'use strict';


module.exports = function (N, modelName) {
  N.wire.on("init:models", function emit_init_LoginLimitIP(__, callback) {
    var LoginLimitIP = N.runtime.redback.createRateLimit('block:login:ip', {
      bucket_span:     60 * (5 + 1)
    , bucket_interval: 60
    , subject_expiry:  10 * 60
    });


    LoginLimitIP.check = function check(ip, callback) {
      this.count(ip, 5 * 60, function (err, count) {
        if (err) {
          callback(err);
          return;
        }
        callback(null, count > 5);
      });
    };

    LoginLimitIP.update = function update(ip, callback) {
      this.add(ip, callback);
    };


    N.wire.emit("init:models." + modelName, LoginLimitIP, callback);
  });

  N.wire.on("init:models." + modelName, function init_model_LoginLimitIP(model) {
    N.models[modelName] = model;
  });
};
