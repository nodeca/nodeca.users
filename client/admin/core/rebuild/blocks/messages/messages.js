// Display message rebuild progress in admin interface
//
'use strict';


const ko = require('knockout');


// Knockout bindings root object.
let view = null;
let CONTAINER_ID = '#rebuild-messages-task';
let finished_tasks = {};


function update_task_status(task_info) {
  if (!view) return;
  if (finished_tasks[task_info.uid]) return;

  if (typeof task_info.current !== 'undefined') {
    view.current(task_info.current);
  }

  if (typeof task_info.total !== 'undefined') {
    view.total(task_info.total);
  }

  if (task_info.finished) {
    view.current(0);
    view.total(1);
    view.started(false);

    finished_tasks[task_info.uid] = true;
  } else {
    view.started(true);
  }
}


N.wire.on('navigate.done:admin.core.rebuild', function rebuild_messages_widget_setup() {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) return;

  let current = N.runtime.page_data.messages_task.current || 0;
  let total   = N.runtime.page_data.messages_task.total || 1;

  view = {
    started:  ko.observable(current > 0 && current < total),
    current:  ko.observable(current),
    total:    ko.observable(total)
  };

  ko.applyBindings(view, container);

  N.live.on('admin.core.rebuild.messages', update_task_status);
});


N.wire.on('navigate.exit:admin.core.rebuild', function rebuild_messages_widget_teardown() {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) return;

  view = null;
  ko.cleanNode(container);

  N.live.off('admin.core.rebuild.messages', update_task_status);
});


N.wire.once('navigate.done:admin.core.rebuild', function rebuild_messages_widget_setup_handlers() {

  // Click on "start" button
  //
  N.wire.on(module.apiPath + '.start', function rebuild_start() {
    N.io.rpc('admin.core.rebuild.messages.start').then(() => {
      // reset progress bar to zero
      view.current(0);
      view.total(1);
      view.started(true);
    });
  });


  // Click on "stop" button
  //
  N.wire.on(module.apiPath + '.stop', function rebuild_stop() {
    N.io.rpc('admin.core.rebuild.messages.stop').then(() => {
      // reset progress bar to zero
      view.current(0);
      view.total(1);
      view.started(false);
    });
  });
});
