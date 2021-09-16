// Rebuild cache and preview for dialogs
//
'use strict';


const _        = require('lodash');
const Queue    = require('idoit');


const CHUNKS_TO_ADD     = 100;
const CHUNKS_MIN_COUNT  = 50;
const DIALOGS_PER_CHUNK = 100;


module.exports = function (N) {
  N.wire.on('init:jobs', function register_dialogs_rebuild() {
    // Iterator
    //
    N.queue.registerTask({
      name: 'dialogs_rebuild',
      pool: 'hard',
      baseClass: Queue.IteratorTemplate,
      taskID: () => 'dialogs_rebuild',

      async iterate(state) {
        if (this.total === 0) return null;

        let active_chunks = this.children_created - this.children_finished;


        // Idle if we still have more than `CHUNKS_MIN_COUNT` chunks
        //
        if (active_chunks >= CHUNKS_MIN_COUNT) return {};


        // Fetch posts _id
        //
        let query = N.models.users.Dialog.find()
                        .where('_id').gte(this.args[0]) // min
                        .select('_id')
                        .sort({ _id: -1 })
                        .limit(DIALOGS_PER_CHUNK * CHUNKS_TO_ADD)
                        .lean(true);

        // If state is present it is always smaller than max _id
        if (state) {
          query.where('_id').lt(state);
        } else {
          query.where('_id').lte(this.args[1]); // max
        }

        let dialogs = await query;


        // Check finished
        //
        if (!dialogs.length) return null;


        // Add chunks
        //
        let chunks = _.chunk(dialogs.map(t => String(t._id)), DIALOGS_PER_CHUNK)
                      .map(ids => N.queue.dialogs_rebuild_chunk(ids));

        return {
          tasks: chunks,
          state: String(dialogs[dialogs.length - 1]._id)
        };
      },

      async init() {
        let query = N.models.users.Dialog.countDocuments();

        if (this.args.length < 1 || !this.args[0]) {
          // if no min _id
          let min_dialog = await N.models.users.Dialog.findOne()
                                     .select('_id')
                                     .sort({ _id: 1 })
                                     .lean(true);

          if (!min_dialog) {
            this.total = 0;
            return;
          }

          this.args[0] = String(min_dialog._id);
        } else {
          // min _id already specified
          // (if it's not, we count all dialogs without extra conditions,
          // which results in faster query)
          query = query.where('_id').gte(this.args[0]);
        }

        if (this.args.length < 2 || !this.args[1]) {
          // if no max _id
          let max_dialog = await N.models.users.Dialog.findOne()
                                    .select('_id')
                                    .sort({ _id: -1 })
                                    .lean(true);

          if (!max_dialog) {
            this.total = 0;
            return;
          }

          this.args[1] = String(max_dialog._id);
        } else {
          // max _id already specified
          query = query.where('_id').lte(this.args[1]);
        }

        let dialogs_count = await query;

        this.total = Math.ceil(dialogs_count / DIALOGS_PER_CHUNK);
      }
    });


    // Chunk
    //
    N.queue.registerTask({
      name: 'dialogs_rebuild_chunk',
      pool: 'hard',
      removeDelay: 3600,
      async process(ids) {
        N.logger.info(`Rebuilding dialog caches ${ids[0]}-${ids[ids.length - 1]} - ${ids.length} found`);

        await Promise.all(ids.map(id => N.models.users.Dialog.updateSummary(id)));
      }
    });


    N.queue.on('task:progress:dialogs_rebuild', function (task_info) {
      N.live.debounce('admin.core.rebuild.dialogs', {
        uid:     task_info.uid,
        current: task_info.progress,
        total:   task_info.total
      });
    });


    N.queue.on('task:end:dialogs_rebuild', function (task_info) {
      N.live.emit('admin.core.rebuild.dialogs', {
        uid:      task_info.uid,
        finished: true
      });
    });
  });
};
