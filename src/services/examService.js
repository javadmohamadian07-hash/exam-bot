import { Exam } from '../models/Exam.js';
import { ExamAttempt } from '../models/ExamAttempt.js';
import { resolveStudentIdsFromCategories } from './categoryService.js';

export async function createExam({
  title,
  pdfUrl,
  pdfFileName,
  pdfFileId,
  answerPdfUrl,
  answerPdfFileName,
  answerPdfFileId,
  startQuestionNumber,
  questionCount,
  durationMinutes,
  allowedStartDate,
  allowedEndDate,
  allowedStudentIds,
  allowedCategoryIds,
  answerKey,
  createdBy = 'admin'
}) {
  if (!answerKey || answerKey.length !== Number(questionCount)) {
    throw new Error(`Answer key count (${answerKey ? answerKey.length : 0}) does not match question count (${questionCount}).`);
  }

  // Resolve categories to student IDs and merge with individually selected students
  const categoryStudentIds = await resolveStudentIdsFromCategories(allowedCategoryIds);
  const mergedStudentIds = new Set([...(allowedStudentIds || []).map(id => id.toString()), ...categoryStudentIds]);
  const finalStudentIds = [...mergedStudentIds];

  const exam = new Exam({
    title,
    pdfUrl: pdfUrl || '',
    pdfFileName: pdfFileName || 'exam.pdf',
    pdfFileId: pdfFileId || null,
    answerPdfUrl: answerPdfUrl || '',
    answerPdfFileName: answerPdfFileName || 'answer-key.pdf',
    answerPdfFileId: answerPdfFileId || null,
    startQuestionNumber: Number(startQuestionNumber) || 1,
    questionCount: Number(questionCount),
    durationMinutes: Number(durationMinutes),
    allowedStartDate: new Date(allowedStartDate),
    allowedEndDate: new Date(allowedEndDate),
    allowedStudentIds: finalStudentIds,
    allowedCategoryIds: allowedCategoryIds || [],
    answerKey,
    isImmutable: true,
    createdBy
  });

  await exam.save();
  return exam;
}

export async function deleteExam(examId) {
  await ExamAttempt.deleteMany({ examId });
  return await Exam.findByIdAndDelete(examId);
}

export async function getExamById(examId) {
  return await Exam.findById(examId).populate('allowedStudentIds', 'fullName username');
}

export async function getAllExams() {
  return await Exam.find({}).sort({ createdAt: -1 }).populate('allowedStudentIds', 'fullName username');
}

export async function getActiveExamsForStudent(studentId) {
  const now = new Date();
  
  // Find exams where student is in allowedStudentIds and allowed window is currently active or started
  const exams = await Exam.find({
    allowedStudentIds: studentId,
    allowedStartDate: { $lte: now },
    allowedEndDate: { $gte: now },
  }).sort({ allowedEndDate: 1 });

  // Filter out exams that student has already COMPLETED
  const activeExams = [];
  for (const exam of exams) {
    const attempt = await ExamAttempt.findOne({
      examId: exam._id,
      studentId,
      status: 'completed'
    });
    if (!attempt) {
      activeExams.push(exam);
    }
  }

  return activeExams;
}

export async function getUpcomingExamsForStudent(studentId) {
  const now = new Date();
  return await Exam.find({
    allowedStudentIds: studentId,
    allowedStartDate: { $gt: now },
  }).sort({ allowedStartDate: 1 });
}

export async function getPreviousResultsForStudent(studentId) {
  const attempts = await ExamAttempt.find({
    studentId,
    status: 'completed'
  }).populate('examId').sort({ finishTime: -1 });

  return attempts;
}

export async function getExamResultsForAdmin(examId) {
  const exam = await Exam.findById(examId);
  if (!exam) return null;

  const attempts = await ExamAttempt.find({
    examId,
    status: 'completed'
  }).populate('studentId', 'fullName username').sort({ percentage: -1, finishTime: 1 });

  return {
    exam,
    attempts
  };
}

export async function recalculateRanksForExam(examId) {
  const attempts = await ExamAttempt.find({
    examId,
    status: 'completed'
  }).sort({ percentage: -1, finishTime: 1 });

  let currentRank = 1;
  for (let i = 0; i < attempts.length; i++) {
    if (i > 0 && attempts[i].percentage < attempts[i - 1].percentage) {
      currentRank = i + 1;
    }
    attempts[i].rank = currentRank;
    await attempts[i].save();
  }

  return attempts;
}
