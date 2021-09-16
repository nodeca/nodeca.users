// Add a widget displaying dialog rebuild progress
//

'use strict';


module.exports = function (N) {
  N.wire.after('server:admin.core.rebuild', { priority: 55 }, async function rebuild_dialogs_widget(env) {
    let task = await N.queue.getTask('dialogs_rebuild');
    let task_info = {};

    if (task && task.state !== 'finished') {
      task_info = {
        current: task.progress,
        total:   task.total
      };
    }

    env.res.blocks.push({ name: 'dialogs', task_info });
  });
};
