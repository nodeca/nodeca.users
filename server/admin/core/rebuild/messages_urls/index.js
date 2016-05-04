// Add a widget displaying urls extraction progress
//

'use strict';


module.exports = function (N) {
  N.wire.after('server:admin.core.rebuild', { priority: 60 }, function* messages_urls_widget(env) {
    let data = yield N.queue.worker('messages_urls').status();

    let task_info = {};

    if (data && data.state === 'aggregating') {
      task_info.current = data.chunks.done + data.chunks.errored;
      task_info.total   = data.chunks.done + data.chunks.errored +
                          data.chunks.active + data.chunks.pending;
    }

    env.res.blocks.push({ name: 'messages_urls', task_info });
  });
};
