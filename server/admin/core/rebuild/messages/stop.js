// Stop PM rebuild
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function* messages_rebuild_stop() {
    yield N.queue.cancel('messages_rebuild');
  });
};
