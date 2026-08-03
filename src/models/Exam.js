import mongoose from 'mongoose';

const ExamSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  pdfUrl: {
    type: String,
    default: '',
  },
  pdfFileName: {
    type: String,
    default: 'exam.pdf',
  },
  pdfFileId: {
    type: String,
    default: null, // Telegram file_id if uploaded in Telegram
  },
  answerPdfUrl: {
    type: String,
    default: '',
  },
  answerPdfFileName: {
    type: String,
    default: 'answer-key.pdf',
  },
  answerPdfFileId: {
    type: String,
    default: null, // Telegram file_id if uploaded in Telegram
  },
  questionCount: {
    type: Number,
    required: true,
    min: 1,
  },
  startQuestionNumber: {
    type: Number,
    default: 1,
    min: 1,
  },
  durationMinutes: {
    type: Number,
    required: true,
    min: 1,
  },
  allowedStartDate: {
    type: Date,
    required: true,
  },
  allowedEndDate: {
    type: Date,
    required: true,
  },
  allowedStudentIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
    },
  ],
  allowedCategoryIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: [],
    },
  ],
  answerKey: [
    {
      type: Number, // 1, 2, 3, or 4
      required: true,
    },
  ],
  isImmutable: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: String,
    default: 'admin',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Exam = mongoose.model('Exam', ExamSchema);
