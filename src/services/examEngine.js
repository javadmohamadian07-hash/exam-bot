import { Exam } from '../models/Exam.js';
import { ExamAttempt } from '../models/ExamAttempt.js';
import { calculateRemainingSeconds } from '../utils/time.js';
import { calculateExamScore } from '../utils/scoring.js';
import { recalculateRanksForExam } from './examService.js';

export async function startOrGetExamAttempt(examId, studentId, telegramId) {
  const exam = await Exam.findById(examId);
  if (!exam) {
    throw new Error('Exam not found.');
  }

  // Check if student is allowed
  const isAllowed = exam.allowedStudentIds.some(
    id => id.toString() === studentId.toString()
  );
  if (!isAllowed) {
    throw new Error('You are not registered for this exam.');
  }

  // Check existing attempt
  let attempt = await ExamAttempt.findOne({ examId, studentId });

  if (attempt) {
    if (attempt.status === 'completed') {
      return { attempt, exam, status: 'completed' };
    }

    // In progress attempt - check if time has expired
    const timeInfo = calculateRemainingSeconds(
      attempt.startTime,
      exam.durationMinutes,
      exam.allowedEndDate
    );

    if (timeInfo.isExpired) {
      // Auto finish exam
      attempt = await finishExamAttempt(attempt._id);
      return { attempt, exam, status: 'completed', autoFinished: true };
    }

    return { attempt, exam, status: 'in_progress', timeInfo };
  }

  // Check if allowed window has passed before starting
  const now = new Date();
  if (now > exam.allowedEndDate) {
    throw new Error('The allowed time window for this exam has ended.');
  }
  if (now < exam.allowedStartDate) {
    throw new Error('This exam has not started yet.');
  }

  // Initialize answers array with blank entries for all questions
  const initialAnswers = [];
  for (let q = 1; q <= exam.questionCount; q++) {
    initialAnswers.push({
      questionNum: q,
      selectedOption: 0,
      isMarked: false,
    });
  }

  attempt = new ExamAttempt({
    examId,
    studentId,
    telegramId: String(telegramId),
    startTime: now,
    answers: initialAnswers,
    status: 'in_progress',
  });

  await attempt.save();

  const timeInfo = calculateRemainingSeconds(
    attempt.startTime,
    exam.durationMinutes,
    exam.allowedEndDate
  );

  return { attempt, exam, status: 'in_progress', timeInfo };
}

export async function getAttemptById(attemptId) {
  return await ExamAttempt.findById(attemptId).populate('examId').populate('studentId');
}

export async function submitAnswer(attemptId, questionNum, option) {
  const attempt = await ExamAttempt.findById(attemptId).populate('examId');
  if (!attempt) throw new Error('Attempt not found.');
  if (attempt.status === 'completed') throw new Error('Exam is already completed.');

  // Check if time expired
  const timeInfo = calculateRemainingSeconds(
    attempt.startTime,
    attempt.examId.durationMinutes,
    attempt.examId.allowedEndDate
  );

  if (timeInfo.isExpired) {
    await finishExamAttempt(attemptId);
    return { isExpired: true, message: 'Time expired! Exam auto-submitted.' };
  }

  // Find or create question answer entry
  const answerIdx = attempt.answers.findIndex(a => a.questionNum === Number(questionNum));
  if (answerIdx >= 0) {
    attempt.answers[answerIdx].selectedOption = Number(option);
  } else {
    attempt.answers.push({
      questionNum: Number(questionNum),
      selectedOption: Number(option),
      isMarked: false,
    });
  }

  await attempt.save();
  return { isExpired: false, attempt };
}

export async function toggleMarkQuestion(attemptId, questionNum) {
  const attempt = await ExamAttempt.findById(attemptId).populate('examId');
  if (!attempt) throw new Error('Attempt not found.');

  const answerIdx = attempt.answers.findIndex(a => a.questionNum === Number(questionNum));
  let isMarked = false;
  if (answerIdx >= 0) {
    attempt.answers[answerIdx].isMarked = !attempt.answers[answerIdx].isMarked;
    isMarked = attempt.answers[answerIdx].isMarked;
  } else {
    attempt.answers.push({
      questionNum: Number(questionNum),
      selectedOption: 0,
      isMarked: true,
    });
    isMarked = true;
  }

  await attempt.save();
  return { attempt, isMarked };
}

export async function finishExamAttempt(attemptId) {
  const attempt = await ExamAttempt.findById(attemptId).populate('examId');
  if (!attempt) throw new Error('Attempt not found.');

  if (attempt.status === 'completed') {
    return attempt;
  }

  const exam = attempt.examId;

  // Build Map of student answers
  const answersMap = new Map();
  attempt.answers.forEach(a => {
    answersMap.set(a.questionNum, a.selectedOption);
  });

  // Calculate score
  const scoreResult = calculateExamScore(answersMap, exam.answerKey);

  attempt.status = 'completed';
  attempt.finishTime = new Date();
  attempt.correctCount = scoreResult.correctCount;
  attempt.wrongCount = scoreResult.wrongCount;
  attempt.blankCount = scoreResult.blankCount;
  attempt.score = scoreResult.score;
  attempt.percentage = scoreResult.percentage;

  await attempt.save();

  // Recalculate rankings for this exam
  await recalculateRanksForExam(exam._id);

  // Reload updated attempt
  return await ExamAttempt.findById(attemptId).populate('examId').populate('studentId');
}

export async function getDetailedAttemptResult(attemptId) {
  const attempt = await ExamAttempt.findById(attemptId).populate('examId').populate('studentId');
  if (!attempt) return null;

  const exam = attempt.examId;
  const answersMap = new Map();
  attempt.answers.forEach(a => answersMap.set(a.questionNum, a));

  const startNum = exam.startQuestionNumber || 1;
  const detailedSheet = [];
  for (let i = 0; i < exam.questionCount; i++) {
    const qNum = i + 1;
    const displayQuestionNum = startNum + i;
    const correctOption = exam.answerKey[i];
    const studentAns = answersMap.get(qNum) || { selectedOption: 0, isMarked: false };
    
    let isCorrect = false;
    let isBlank = studentAns.selectedOption === 0;
    if (!isBlank && studentAns.selectedOption === correctOption) {
      isCorrect = true;
    }

    detailedSheet.push({
      questionNum: qNum,
      displayQuestionNum,
      studentOption: studentAns.selectedOption,
      correctOption,
      isCorrect,
      isBlank,
      isMarked: studentAns.isMarked,
    });
  }

  return {
    attempt,
    exam,
    detailedSheet,
  };
}
