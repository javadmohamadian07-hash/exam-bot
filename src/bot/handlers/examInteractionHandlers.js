import { 
  startOrGetExamAttempt, 
  submitAnswer, 
  toggleMarkQuestion, 
  finishExamAttempt, 
  getDetailedAttemptResult,
  getAttemptById
} from '../../services/examEngine.js';
import { 
  getQuestionKeyboard, 
  getStartAnswerSheetKeyboard, 
  getExamToolbarKeyboard,
  getConfirmFinishKeyboard 
} from '../../keyboards/examKeyboards.js';
import { getStudentMenuKeyboard } from '../../keyboards/mainMenu.js';
import { calculateRemainingSeconds, formatDuration, formatJalaliDate } from '../../utils/time.js';

export async function handleSelectExam(ctx) {
  const student = ctx.state.student;
  if (!student) return ctx.reply('❌ لطفاً ابتدا با /login وارد شوید.');

  const examId = ctx.callbackQuery.data.replace('select_exam_', '').replace('start_exam_', '');

  try {
    const { attempt, exam, status, timeInfo, autoFinished } = await startOrGetExamAttempt(
      examId,
      student._id,
      ctx.from.id
    );

    if (status === 'completed') {
      if (autoFinished) {
        await ctx.reply('⏱️ *زمان به پایان رسید!* آزمون شما به طور خودکار ثبت شد.', { parse_mode: 'Markdown' });
      }
      // Show result
      return await showFinalExamResult(ctx, attempt._id);
    }

    // 1. Send PDF
    await ctx.reply(`📝 *شروع آزمون: ${exam.title}*\n\n⏱️ مدت زمان: ${exam.durationMinutes} دقیقه\nزمان باقی‌مانده: *${formatDuration(timeInfo.remainingSeconds)}*`, { parse_mode: 'Markdown' });

    if (exam.pdfFileId) {
      await ctx.replyWithDocument(exam.pdfFileId, {
        caption: `📄 فایل PDF آزمون: ${exam.title}`,
        reply_markup: getStartAnswerSheetKeyboard(attempt._id, exam._id)
      });
    } else if (exam.pdfUrl) {
      await ctx.reply(`📄 دانلود PDF آزمون: ${exam.pdfUrl}`, {
        reply_markup: getStartAnswerSheetKeyboard(attempt._id, exam._id)
      });
    } else {
      await ctx.reply(`📄 فایل PDF آماده است. برای نمایش پاسخ‌برگ کلید زیر را بزنید:`, {
        reply_markup: getStartAnswerSheetKeyboard(attempt._id, exam._id)
      });
    }

  } catch (error) {
    await ctx.reply(`❌ امکان شروع آزمون وجود ندارد: ${error.message}`);
  }
}

export async function handleShowAnswerSheet(ctx) {
  const data = ctx.callbackQuery.data.split(':');
  const attemptId = data[1];

  const attemptData = await getAttemptById(attemptId);
  if (!attemptData) return ctx.answerCallbackQuery('آزمون یافت نشد');

  const { examId: exam, answers } = attemptData;

  const answersMap = new Map();
  answers.forEach(a => answersMap.set(a.questionNum, a));

  await ctx.answerCallbackQuery('پاسخ‌برگ بارگذاری شد');
  await ctx.reply(`📋 *پاسخ‌برگ آزمون ${exam.title}* (${exam.questionCount} سوال)\n\nگزینه پاسخ خود را برای هر سوال انتخاب کنید:`, {
    parse_mode: 'Markdown',
    reply_markup: getExamToolbarKeyboard()
  });

  // Generate each question as a message
  const startNum = exam.startQuestionNumber || 1;
  for (let q = 1; q <= exam.questionCount; q++) {
    const ans = answersMap.get(q) || { selectedOption: 0, isMarked: false };
    const keyboard = getQuestionKeyboard(attemptId, q, ans.selectedOption, ans.isMarked);

    let qText = `سوال ${startNum + q - 1}`;
    if (ans.selectedOption > 0) {
      qText += ` (انتخاب شده: گزینه ${ans.selectedOption})`;
    }
    if (ans.isMarked) {
      qText += ` 📌 [نشان‌دار]`;
    }

    await ctx.reply(qText, { reply_markup: keyboard });
  }
}

export async function handleAnswerSelection(ctx) {
  const data = ctx.callbackQuery.data.split(':'); // ans:attemptId:questionNum:option
  const attemptId = data[1];
  const questionNum = parseInt(data[2], 10);
  const option = parseInt(data[3], 10);

  const res = await submitAnswer(attemptId, questionNum, option);

  if (res.isExpired) {
    await ctx.answerCallbackQuery('⏱️ زمان آزمون به پایان رسید!');
    await ctx.editMessageText(`⏱️ *زمان پایان یافت!* سوال ${questionNum} - آزمون به طور خودکار ثبت شد.`);
    return await showFinalExamResult(ctx, attemptId);
  }

  const attempt = res.attempt;
  const ans = attempt.answers.find(a => a.questionNum === questionNum) || { selectedOption: option, isMarked: false };
  const startNum = attempt.examId.startQuestionNumber || 1;

  const keyboard = getQuestionKeyboard(attemptId, questionNum, option, ans.isMarked);

  let qText = `سوال ${startNum + questionNum - 1}`;
  if (option > 0) {
    qText += ` (انتخاب شده: گزینه ${option})`;
  } else {
    qText += ` (بدون پاسخ)`;
  }
  if (ans.isMarked) {
    qText += ` 📌 [نشان‌دار]`;
  }

  await ctx.answerCallbackQuery(`گزینه ${option === 0 ? 'پاک شد' : option} ثبت گردید`);
  try {
    await ctx.editMessageText(qText, { reply_markup: keyboard });
  } catch (e) {
    // Ignore message not modified error
  }
}

export async function handleToggleMark(ctx) {
  const data = ctx.callbackQuery.data.split(':'); // mark:attemptId:questionNum
  const attemptId = data[1];
  const questionNum = parseInt(data[2], 10);

  const { attempt, isMarked } = await toggleMarkQuestion(attemptId, questionNum);
  const startNum = attempt.examId.startQuestionNumber || 1;

  const ans = attempt.answers.find(a => a.questionNum === questionNum) || { selectedOption: 0, isMarked };
  const keyboard = getQuestionKeyboard(attemptId, questionNum, ans.selectedOption, isMarked);

  let qText = `سوال ${startNum + questionNum - 1}`;
  if (ans.selectedOption > 0) {
    qText += ` (انتخاب شده: گزینه ${ans.selectedOption})`;
  }
  if (isMarked) {
    qText += ` 📌 [نشان‌دار]`;
  }

  await ctx.answerCallbackQuery(isMarked ? 'سوال نشان‌گذاری شد 📌' : 'نشان‌گذاری سوال برداشته شد 📍');
  try {
    await ctx.editMessageText(qText, { reply_markup: keyboard });
  } catch (e) {
    // Ignore
  }
}

export async function handleCheckRemainingTime(ctx) {
  const student = ctx.state.student;
  if (!student) return ctx.reply('❌ لطفاً وارد شوید.');

  // Find active attempt for student
  const attempt = await getActiveAttemptForStudent(student._id);
  if (!attempt) {
    return ctx.reply('ℹ️ شما در حال حاضر آزمون فعالی ندارید.');
  }

  const exam = attempt.examId;
  const timeInfo = calculateRemainingSeconds(attempt.startTime, exam.durationMinutes, exam.allowedEndDate);

  if (timeInfo.isExpired) {
    await finishExamAttempt(attempt._id);
    await ctx.reply('⏱️ *زمان به پایان رسید!* آزمون شما به پایان رسید.', { parse_mode: 'Markdown' });
    return await showFinalExamResult(ctx, attempt._id);
  }

  await ctx.reply(`⏳ *زمان باقی‌مانده:* \`${formatDuration(timeInfo.remainingSeconds)}\`\n\nزمان پایان آزمون: ${formatJalaliDate(timeInfo.actualEndTime)} (تایم تهران)`, { parse_mode: 'Markdown' });
}

export async function handleShowMarkedQuestions(ctx) {
  const student = ctx.state.student;
  if (!student) return ctx.reply('❌ لطفاً وارد شوید.');

  const attempt = await getActiveAttemptForStudent(student._id);
  if (!attempt) return ctx.reply('ℹ️ آزمون فعالی یافت نشد.');

  const startNum = attempt.examId.startQuestionNumber || 1;
  const marked = attempt.answers.filter(a => a.isMarked).map(a => startNum + a.questionNum - 1);

  if (marked.length === 0) {
    return ctx.reply('📌 شما هنوز هیچ سوالی را نشان‌گذاری نکرده‌اید.');
  }

  await ctx.reply(`📌 *سوالات نشان‌دار شده (${marked.length} سوال):*\n\nشماره سوال(ها): ${marked.join(', ')}`, { parse_mode: 'Markdown' });
}

export async function handleShowUnansweredQuestions(ctx) {
  const student = ctx.state.student;
  if (!student) return ctx.reply('❌ لطفاً وارد شوید.');

  const attempt = await getActiveAttemptForStudent(student._id);
  if (!attempt) return ctx.reply('ℹ️ آزمون فعالی یافت نشد.');

  const total = attempt.examId.questionCount;
  const startNum = attempt.examId.startQuestionNumber || 1;
  const answeredSet = new Set(attempt.answers.filter(a => a.selectedOption > 0).map(a => a.questionNum));

  const unanswered = [];
  for (let q = 1; q <= total; q++) {
    if (!answeredSet.has(q)) unanswered.push(startNum + q - 1);
  }

  if (unanswered.length === 0) {
    return ctx.reply('🎉 تبریک! به تمام سوالات پاسخ داده‌اید.');
  }

  await ctx.reply(`❓ *سوالات بدون پاسخ (${unanswered.length} از ${total}):*\n\nشماره سوال(ها): ${unanswered.join(', ')}`, { parse_mode: 'Markdown' });
}

export async function handleRedownloadPDF(ctx) {
  const student = ctx.state.student;
  if (!student) return ctx.reply('❌ لطفاً وارد شوید.');

  const attempt = await getActiveAttemptForStudent(student._id);
  if (!attempt) return ctx.reply('ℹ️ آزمون فعالی یافت نشد.');

  const exam = attempt.examId;
  await ctx.reply(`📄 *ارسال مجدد فایل PDF برای ${exam.title}...*\n(زمان‌سنج آزمون بدون بازنشانی به شمارش ادامه می‌دهد)`, { parse_mode: 'Markdown' });

  if (exam.pdfFileId) {
    await ctx.replyWithDocument(exam.pdfFileId, { caption: `📄 فایل PDF آزمون: ${exam.title}` });
  } else if (exam.pdfUrl) {
    await ctx.reply(`📄 لینک دانلود PDF: ${exam.pdfUrl}`);
  } else {
    await ctx.reply(`📄 فایل PDF مجدداً ارسال گردید.`);
  }
}

export async function handleFinishExamPrompt(ctx) {
  const student = ctx.state.student;
  if (!student) return ctx.reply('❌ لطفاً وارد شوید.');

  const attempt = await getActiveAttemptForStudent(student._id);
  if (!attempt) return ctx.reply('ℹ️ هیچ آزمون فعالی برای ثبت نهایی وجود ندارد.');

  await ctx.reply('⚠️ *آیا مطمئن هستید که می‌خواهید آزمون را به پایان برسانید و ثبت نهایی کنید؟*', {
    parse_mode: 'Markdown',
    reply_markup: getConfirmFinishKeyboard(attempt._id)
  });
}

export async function handleConfirmFinish(ctx) {
  const attemptId = ctx.callbackQuery.data.replace('confirm_finish:', '');
  const attempt = await finishExamAttempt(attemptId);

  await ctx.answerCallbackQuery('آزمون پایان یافت');
  await ctx.reply('✅ *آزمون با موفقیت ثبت نهایی شد!*', { parse_mode: 'Markdown' });
  await showFinalExamResult(ctx, attempt._id);
}

export async function handleCancelFinish(ctx) {
  const attemptId = ctx.callbackQuery.data.replace('cancel_finish:', '');
  await ctx.answerCallbackQuery('انصراف داده شد');
  await ctx.editMessageText('✅ آزمون ادامه یافت. می‌توانید به پاسخ‌دهی سوالات ادامه دهید.');
}

async function getActiveAttemptForStudent(studentId) {
  const { ExamAttempt } = await import('../../models/ExamAttempt.js');
  return await ExamAttempt.findOne({ studentId, status: 'in_progress' }).populate('examId');
}

export async function showFinalExamResult(ctx, attemptId) {
  const detail = await getDetailedAttemptResult(attemptId);
  if (!detail) return;

  const { attempt, exam, detailedSheet } = detail;

  let text = `📊 *نتیجه آزمون: ${exam.title}*\n\n`;
  text += `• *درصد:* *${attempt.percentage}%*\n`;
  text += `• *رتبه:* *#${attempt.rank || 1}*\n`;
  text += `• *نمره:* *${attempt.score}* از ${exam.questionCount}\n\n`;
  text += `✅ درست: *${attempt.correctCount}*\n`;
  text += `❌ نادرست: *${attempt.wrongCount}*\n`;
  text += `⚪ نزده: *${attempt.blankCount}*\n\n`;

  text += `📋 *پاسخ‌برگ تشریحی:*\n\n`;
  detailedSheet.forEach(q => {
    const icon = q.isCorrect ? '✅ درست' : (q.isBlank ? '⚪ نزده' : '❌ نادرست');
    const studAnsStr = q.studentOption === 0 ? 'بدون پاسخ' : `گزینه ${q.studentOption}`;
    const displayNum = q.displayQuestionNum || q.questionNum;
    text += `سوال ${displayNum}: ${icon} | پاسخ شما: ${studAnsStr} | پاسخ صحیح: گزینه ${q.correctOption}\n`;
  });

  await ctx.reply(text, { parse_mode: 'Markdown' });
  
  // Show student main menu after result
  await ctx.reply('🔙 *بازگشت به منوی اصلی*', {
    parse_mode: 'Markdown',
    reply_markup: getStudentMenuKeyboard(),
  });
}
