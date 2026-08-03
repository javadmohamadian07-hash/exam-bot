import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  username: {
    type: String,
    default: 'admin',
  },
  fullName: {
    type: String,
    default: 'System Admin',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Admin = mongoose.model('Admin', AdminSchema);
