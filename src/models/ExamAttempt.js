import mongoose from 'mongoose';

const AnswerSchema = new mongoose.Schema(
  {
    questionNum: {
      type: Number,
      required: true,
    },
    selectedOption: {
      type: Number,
      default: 0, // 0 = unanswered/blank, 1..4 = choice
    },
    isMarked: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const ExamAttemptSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true,
    index: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true,
  },
  telegramId: {
    type: String,
    required: true,
  },
  startTime: {
    type: Date,
    default: Date.now,
  },
  finishTime: {
    type: Date,
    default: null,
  },
  answers: [AnswerSchema],
  status: {
    type: String,
    enum: ['in_progress', 'completed'],
    default: 'in_progress',
    index: true,
  },
  correctCount: {
    type: Number,
    default: 0,
  },
  wrongCount: {
    type: Number,
    default: 0,
  },
  blankCount: {
    type: Number,
    default: 0,
  },
  score: {
    type: Number,
    default: 0,
  },
  percentage: {
    type: Number,
    default: 0,
  },
  rank: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const ExamAttempt = mongoose.model('ExamAttempt', ExamAttemptSchema);
