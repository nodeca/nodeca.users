// Add a widget displaying message rebuild progress
//

'use strict';


module.exports = function (N) {
  N.wire.after('server:admin.core.rebuild', { priority: 50 }, function* rebuild_messages_widget(env) {
    let data = yield N.queue.worker('messages_rebuild').status();

    let task_info = {};

    if (data && data.state === 'aggregating') {
      task_info.current = data.chunks.done + data.chunks.errored;
      task_info.total   = data.chunks.done + data.chunks.errored +
                          data.chunks.active + data.chunks.pending;
    }

    env.res.blocks.push({ name: 'messages', task_info });
  });
};
