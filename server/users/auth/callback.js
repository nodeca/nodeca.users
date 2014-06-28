
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    provider: { type: 'string', required: true }
  });


  N.wire.on(apiPath, function oauth_callback(/*env, callback*/) {
    //console.log('callback');
  });
};
