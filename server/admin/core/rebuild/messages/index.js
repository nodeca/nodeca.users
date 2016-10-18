// Add a widget displaying message rebuild progress
//

'use strict';


module.exports = function (N) {
  N.wire.after('server:admin.core.rebuild', { priority: 50 }, function* rebuild_messages_widget(env) {
    let task = yield N.queue.getTask('messages_rebuild');
    let task_info = {};

    if (task && task.state !== 'finished') {
      task_info = {
        current: task.progress,
        total:   task.total
      };
    }

    env.res.blocks.push({ name: 'messages', task_info });
  });
};
