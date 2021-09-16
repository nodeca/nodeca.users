// Start PM rebuild
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, async function dialogs_rebuild_start() {
    await N.queue.dialogs_rebuild().run();
  });
};
