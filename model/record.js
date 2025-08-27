var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var recordSchema = new Schema({
    project_id:String,
    name: String,
    branch: String,
    ip: String,
    path: String,
    createTime: {
        type: Date,
        default: Date.now
    },
    updateTime: {
        type: Date,
        default: Date.now
    },
    log: {
        type: String,
        default: ''
    },
    success: {
        type: Boolean,
        default: true
    },
    triggerBy: {
        type: String,
        default: ''
    }
}, {
    versionKey: false,
    timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
})

recordSchema.index({ project_id: 1 });

module.exports = mongoose.model('record', recordSchema);
