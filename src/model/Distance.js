const mongoose = require('mongoose');

const DistanceSchema = new mongoose.Schema(
  {
    item_id: {
      type: Number,
      required: true,
      unique: true
    },

    title: {
      type: String,
      required: true
    },

    all_distance: {
      type: Number,
    //   required: true
    },

    checkpoints: [
      {
        name: { type: String, required: true },
        title: { type: String, required: true },
        distance: { type: Number, required: true },

        lap_num: { type: Number, default: 0 },
        lap_m: { type: Number, default: 0 },

        lap_end: {
          type: String,
        //   enum: ['together', 'separate'],
        //   default: 'together'
        },
        _id: false
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Distance', DistanceSchema);
