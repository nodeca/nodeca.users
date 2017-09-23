// Start PM rebuild
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, async function messages_rebuild_start() {
    await N.queue.messages_rebuild().run();
  });
};
