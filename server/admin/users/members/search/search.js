'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    nick:          { type: 'string' },
    usergroup:     { format: 'mongo' },
    email:         { type: 'string' },
    reg_date_from: { type: 'string' },
    reg_date_to:   { type: 'string' }
  });


  N.wire.on(apiPath, function member_search(/*env*/) {
    // FIXME: implement me
  });
};
