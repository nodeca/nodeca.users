// Stop link extraction from messages
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, function* messages_urls_stop() {
    yield N.queue.worker('messages_urls').cancel();
  });
};
