import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  password: {
    type: String,
    required: true,
  },
  telegramId: {
    type: String,
    default: null,
    index: true,
  },
  isLinked: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Student = mongoose.model('Student', StudentSchema);
