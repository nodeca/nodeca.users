// Stop PM rebuild
//

'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {});

  N.wire.on(apiPath, async function dialogs_rebuild_stop() {
    await N.queue.cancel('dialogs_rebuild');
  });
};
