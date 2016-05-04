// Start PM rebuild
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function* messages_rebuild_start() {
    yield N.queue.worker('messages_rebuild').push();
  });
};
