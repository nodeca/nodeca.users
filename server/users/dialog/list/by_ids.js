// Get messages by ids
//
'use strict';


// Max messages to fetch
const LIMIT = 100;


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    dialog_id:    { format: 'mongo', required: true },
    messages_ids: { type: 'array', required: true, uniqueItems: true, maxItems: LIMIT, items: { format: 'mongo' } }
  });


  function buildMessageIds(env) {
    env.data.messages_ids = env.params.messages_ids;
    return Promise.resolve();
  }


  // Fetch messages subcall
  //
  N.wire.on(apiPath, function fetch_message_list(env) {
    env.data.dialog_id = env.params.dialog_id;
    env.data.build_messages_ids = buildMessageIds;

    return N.wire.emit('internal:users.message_list', env);
  });
};
