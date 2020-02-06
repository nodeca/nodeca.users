'use strict';


const _        = require('lodash');
const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;


module.exports = function (N, collectionName) {

  function set_content_type(name, value) {
    let duplicate = _.invert(_.get(N, 'shared.content_type', {}))[value];

    if (typeof duplicate !== 'undefined') {
      throw new Error(`Duplicate content type id=${value} for ${name} and ${duplicate}`);
    }

    _.set(N, 'shared.content_type.' + name, value);
  }

  set_content_type('DIALOG_MESSAGE', 8);

  let DlgMessage = new Schema({
    parent       : Schema.Types.ObjectId, // dialog id
    user         : Schema.Types.ObjectId,
    ts           : { type: Date, default: Date.now },
    ip           : String,  // ip address
    exists       : { type: Boolean, default: true },
    common_id    : Schema.Types.ObjectId,


    html         : String,
    md           : String,
    params_ref   : Schema.ObjectId,
    imports      : [ String ],
    import_users : [ Schema.ObjectId ]
  }, {
    versionKey: false
  });


  /////////////////////////////////////////////////////////////////////////////
  // Indexes

  // Used in messages list
  DlgMessage.index({ parent: 1, exists: 1, _id: -1 });

  /////////////////////////////////////////////////////////////////////////////


  // Store parser options separately and save reference to them
  //
  DlgMessage.pre('save', async function () {
    if (!this.params) return;

    let id = await N.models.core.MessageParams.setParams(this.params);

    /*eslint-disable no-undefined*/
    this.params = undefined;
    this.params_ref = id;
  });


  N.wire.on('init:models', function emit_init_DlgMessage() {
    return N.wire.emit('init:models.' + collectionName, DlgMessage);
  });


  N.wire.on('init:models.' + collectionName, function init_model_DlgMessage(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
