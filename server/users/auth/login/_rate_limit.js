// helper module, to track login requests rate.
// just to keep constants in single place

"use strict";

/*global nodeca*/

var redback = nodeca.components.redback;

// Global invalid login attempts, trace 60 attempts / 60 seconds.
// Used to avoid CPU overload by bcrypt: just force user to enter captcha
var limit_total = redback.createRateLimit('limit:login', {
  bucket_span: 60 + 20,
  bucket_interval: 10,
  subject_expiry: 2 * 60
});

// Track invalid login attempts for single IP. Don't allow
// more than 5 attempts in 5 minutes
var limit_ip = redback.createRateLimit('block:login:ip', {
  bucket_span: (5 + 1) * 60,
  bucket_interval: 60,
  subject_expiry: 10 * 60
});


module.exports = {

  total: {
    count: function (callback) {
      limit_total.count('all', 60, function (err, count) {
        if (err) {
          callback(err);
          return;
        }
        callback(null, (count > 60) ? true : false);
      });
    },
    update: function (callback) {
      limit_total.add('all', callback);
    }
  },

  ip: {
    count: function (ip, callback) {
      limit_ip.count(ip, 5 * 60, function (err, count) {
        if (err) {
          callback(err);
          return;
        }
        callback(null, (count > 5) ? true : false);
      });
    },
    update: function (ip, callback) {
      limit_ip.add(ip, callback);
    }
  }

};
