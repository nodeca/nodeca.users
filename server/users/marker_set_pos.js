// Upload markers
//
'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        content_id:  { format: 'mongo', required: true },
        category_id: { format: 'mongo', required: true },
        type:        { type: 'string',  required: true },
        position:    { type: 'integer', minimum: 1, required: true },
        max:         { type: 'integer', minimum: 1, required: true }
      },
      required: true,
      additionalProperties: false
    },
    properties: {},
    additionalProperties: false,
    required: true
  });


  N.wire.on(apiPath, async function set_markers(env) {
    for (let data of env.params) {
      if (!N.shared.marker_types.includes(data.type)) throw N.io.BAD_REQUEST;

      await N.models.users.Marker.setPos(
        env.user_info.user_id,
        data.content_id,
        data.category_id,
        data.type,
        data.position,
        data.max
      );
    }
  });
};
