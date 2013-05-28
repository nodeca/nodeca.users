// Global invalid login attempts, trace 60 attempts / 60 seconds.
// Used to avoid CPU overload by bcrypt.


'use strict';


module.exports = function (N, modelName) {
  N.wire.on("init:models", function emit_init_LoginLimitTotal(__, callback) {
    var LoginLimitTotal = N.runtime.redback.createRateLimit('limit:login', {
      bucket_span:     60 + 20
    , bucket_interval: 10
    , subject_expiry:  2 * 60
    });


    LoginLimitTotal.check = function check(callback) {
      this.count('all', 60, function (err, count) {
        if (err) {
          callback(err);
          return;
        }
        callback(null, count > 60);
      });
    };

    LoginLimitTotal.update = function update(callback) {
      this.add('all', callback);
    };


    N.wire.emit("init:models." + modelName, LoginLimitTotal, callback);
  });

  N.wire.on("init:models." + modelName, function init_model_LoginLimitTotal(model) {
    N.models[modelName] = model;
  });
};
