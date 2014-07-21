// Helper module used to control total and per-IP login rate limits.


'use strict';


var _ = require('lodash');


module.exports = _.once(function (N) {
  // Global invalid login attempts, trace 60 attempts / 60 seconds.
  // Used to avoid CPU overload by bcrypt.
  var totalRateLimit = N.redback.createRateLimit('limit:login:global', {
    bucket_span:     60 + 20
  , bucket_interval: 10
  , subject_expiry:  2 * 60
  });

  totalRateLimit.check = function check(callback) {
    this.count('all', 60, function (err, count) {
      if (err) {
        callback(err);
        return;
      }
      callback(null, count > 60);
    });
  };

  totalRateLimit.update = function update(callback) {
    this.add('all', callback);
  };


  // Used to track invalid login attempts for single IP.
  // Maximum 5 attempts in 5 minutes.
  var ipRateLimit = N.redback.createRateLimit('limit:login:ip', {
    bucket_span:     60 * (5 + 1)
  , bucket_interval: 60
  , subject_expiry:  10 * 60
  });

  ipRateLimit.check = function check(ip, callback) {
    this.count(ip, 5 * 60, function (err, count) {
      if (err) {
        callback(err);
        return;
      }
      callback(null, count > 5);
    });
  };

  ipRateLimit.update = function update(ip, callback) {
    this.add(ip, callback);
  };


  return { total: totalRateLimit, ip: ipRateLimit };
});
