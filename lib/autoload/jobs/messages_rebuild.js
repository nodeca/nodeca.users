// Rebuild all messages
//
'use strict';


const _        = require('lodash');
const Queue    = require('idoit');


const CHUNKS_TO_ADD    = 100;
const CHUNKS_MIN_COUNT = 50;
const MSG_PER_CHUNK    = 50;


module.exports = function (N) {
  N.wire.on('init:jobs', function register_messages_rebuild() {
    // Iterator
    //
    N.queue.registerTask({
      name: 'messages_rebuild',
      pool: 'hard',
      baseClass: Queue.IteratorTemplate,
      taskID: () => 'messages_rebuild',

      async iterate(state) {
        let active_chunks = this.children_created - this.children_finished;


        // Idle if we still have more than `CHUNKS_MIN_COUNT` chunks
        //
        if (active_chunks >= CHUNKS_MIN_COUNT) return {};


        // Fetch posts _id
        //
        let query = N.models.users.DlgMessage.find()
                        .where('_id').gte(this.args[0]) // min
                        .select('_id')
                        .sort({ _id: -1 })
                        .limit(MSG_PER_CHUNK * CHUNKS_TO_ADD)
                        .lean(true);

        // If state is present it is always smaller than max _id
        if (state) {
          query.where('_id').lt(state);
        } else {
          query.where('_id').lte(this.args[1]); // max
        }

        let msgs = await query;


        // Check finished
        //
        if (!msgs.length) return;


        // Add chunks
        //
        let chunks = _.chunk(msgs.map(p => String(p._id)), MSG_PER_CHUNK)
                      .map(ids => N.queue.messages_rebuild_chunk(ids));

        return {
          tasks: chunks,
          state: String(msgs[msgs.length - 1]._id)
        };
      },

      async init() {
        let query = N.models.users.DlgMessage.count();

        if (this.args.length < 1 || !this.args[0]) {
          // if no min _id
          let min_topic = await N.models.users.DlgMessage.findOne()
                                    .select('_id')
                                    .sort({ _id: 1 })
                                    .lean(true);

          this.args[0] = String(min_topic._id);
        } else {
          // min _id already specified
          // (if it's not, we count all posts without extra conditions,
          // which results in faster query)
          query = query.where('_id').gte(this.args[0]);
        }

        if (this.args.length < 2 || !this.args[1]) {
          // if no max _id
          let max_topic = await N.models.users.DlgMessage.findOne()
                                    .select('_id')
                                    .sort({ _id: -1 })
                                    .lean(true);

          this.args[1] = String(max_topic._id);
        } else {
          // max _id already specified
          query = query.where('_id').lte(this.args[1]);
        }

        let msg_count = await query;

        this.total = Math.ceil(msg_count / MSG_PER_CHUNK);
      }
    });


    // Chunk
    //
    N.queue.registerTask({
      name: 'messages_rebuild_chunk',
      pool: 'hard',
      removeDelay: 3600,
      async process(ids) {
        let start_time = Date.now();

        N.logger.info(`Rebuilding dialogs ${ids[0]}-${ids[ids.length - 1]} - ${ids.length} found`);

        await Promise.all(
          ids.map(id =>
            N.wire.emit('internal:users.message_rebuild', id)
                  .catch(err => N.logger.error('Failed to rebuild message id=' + id + ': ' + (err.stack || err)))
          )
        );

        N.logger.info(`Rebuilding dialogs ${ids[0]}-${ids[ids.length - 1]} - finished (${
          ((Date.now() - start_time) / 1000).toFixed(1)
          }s)`);
      }
    });


    N.queue.on('task:progress:messages_rebuild', function (task_info) {
      N.live.debounce('admin.core.rebuild.messages', {
        uid:     task_info.uid,
        current: task_info.progress,
        total:   task_info.total
      });
    });


    N.queue.on('task:end:messages_rebuild', function (task_info) {
      N.live.emit('admin.core.rebuild.messages', {
        uid:      task_info.uid,
        finished: true
      });
    });
  });
};
