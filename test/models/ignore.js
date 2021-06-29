'use strict';


const assert   = require('assert');
const ObjectId = require('mongoose').Types.ObjectId;


describe('Ignore', function () {
  it('should expire ignore entries', async function () {
    let id1 = new ObjectId();
    let id2 = new ObjectId();
    let id3 = new ObjectId();
    let id4 = new ObjectId();
    let id5 = new ObjectId();

    await (new TEST.N.models.users.Ignore({
      from: id1,
      to: id2
    })).save();

    await (new TEST.N.models.users.Ignore({
      from: id1,
      to: id3,
      expire: new Date(Date.now() - 60000)
    })).save();

    await (new TEST.N.models.users.Ignore({
      from: id1,
      to: id4,
      expire: new Date(Date.now() + 60000)
    })).save();

    await (new TEST.N.models.users.Ignore({
      from: id1,
      to: id5,
      expire: new Date(Date.now() - 120000)
    })).save();

    // Run task
    let task_id = await TEST.N.queue.ignore_expire().run();
    let retries = 100;

    let task = await TEST.N.queue.getTask(task_id);

    while (task.state !== 'finished' && --retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
      task = await TEST.N.queue.getTask(task_id);
    }

    if (!retries) throw new Error('Task waiting timeout');

    let ignored_users = await TEST.N.models.users.Ignore.find({ from: id1 }).lean(true);

    assert.deepEqual(ignored_users.map(x => x.to), [ id2, id4 ]);
  });
});
