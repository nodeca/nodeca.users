// Start link extraction from messages
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function* messages_urls_start() {
    yield N.queue.worker('messages_urls').push();
  });
};
