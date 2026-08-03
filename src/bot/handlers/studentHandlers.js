import { InlineKeyboard } from 'grammy';
import { linkStudentTelegramId, getStudentByTelegramId, logoutStudent } from '../../services/studentService.js';
import { getActiveExamsForStudent, getUpcomingExamsForStudent, getPreviousResultsForStudent } from '../../services/examService.js';
import { getStudentMenuKeyboard, getExamSelectionKeyboard } from '../../keyboards/mainMenu.js';
import { getDetailedAttemptResult } from '../../services/examEngine.js';
import { formatJalaliDate } from '../../utils/time.js';

export async function handleStudentLoginPrompt(ctx) {
  ctx.session.loginState = { step: 'awaiting_login' };
  await ctx.reply(
    `🔐 *ورود دانش‌آموز*\n\n` +
    `لطفاً نام کاربری و کلمه عبور خود را با یک فاصله وارد کنید:\n\n` +
    `مثال:\n` +
    `\`ali 123456\``,
    { parse_mode: 'Markdown' }
  );
}

export async function handleProcessStudentLogin(ctx) {
  if (!ctx.session.loginState || ctx.session.loginState.step !== 'awaiting_login') {
    return false;
  }

  const text = ctx.message.text.trim();
  const parts = text.split(/\s+/);

  if (parts.length < 2) {
    await ctx.reply('❌ لطفاً نام کاربری و کلمه عبور را با فاصله ارسال کنید. مثال: `ali 123456`', { parse_mode: 'Markdown' });
    return true;
  }

  const username = parts[0];
  const password = parts[1];
  const telegramId = ctx.from.id.toString();

  const result = await linkStudentTelegramId(username, password, telegramId);

  if (!result.success) {
    await ctx.reply(`❌ ${result.message}`);
    return true;
  }

  ctx.session.loginState = null;
  const student = result.student;

  // Show welcome back message & active exams
  const activeExams = await getActiveExamsForStudent(student._id);

  let welcomeText = `👋 *سلام ${student.fullName}.*\nخوش آمدید!\n\n`;
  if (activeExams.length > 0) {
    welcomeText += `📝 *آزمون‌های فعال و در دسترس (${activeExams.length}):*\nبرای شروع، آزمون مورد نظر را انتخاب کنید:`;
  } else {
    welcomeText += `ℹ️ در حال حاضر هیچ آزمون فعالی برای شما وجود ندارد.`;
  }

  await ctx.reply(welcomeText, {
    parse_mode: 'Markdown',
    reply_markup: activeExams.length > 0 ? getExamSelectionKeyboard(activeExams, 'select_exam') : getStudentMenuKeyboard()
  });

  if (activeExams.length > 0) {
    await ctx.reply('از منوی زیر برای ناوبری استفاده کنید:', { reply_markup: getStudentMenuKeyboard() });
  }

  return true;
}

export async function handleShowActiveExams(ctx) {
  const student = ctx.state.student;
  if (!student) return ctx.reply('❌ لطفاً ابتدا با دستور /login وارد شوید.');

  const activeExams = await getActiveExamsForStudent(student._id);
  if (!activeExams || activeExams.length === 0) {
    return ctx.reply('ℹ️ در حال حاضر هیچ آزمون فعالی ندارید.');
  }

  let text = `📝 *آزمون‌های فعال و در دسترس (${activeExams.length}):*\nبرای شروع، آزمون مورد نظر را انتخاب کنید:`;
  await ctx.reply(text, {
    parse_mode: 'Markdown',
    reply_markup: getExamSelectionKeyboard(activeExams, 'select_exam')
  });
}

export async function handleShowUpcomingExams(ctx) {
  const student = ctx.state.student;
  if (!student) return ctx.reply('❌ لطفاً ابتدا با دستور /login وارد شوید.');

  const upcomingExams = await getUpcomingExamsForStudent(student._id);
  if (!upcomingExams || upcomingExams.length === 0) {
    return ctx.reply('ℹ️ هیچ آزمون آینده‌ای برنامه‌ریزی نشده است.');
  }

  let text = `📅 *آزمون‌های آینده (${upcomingExams.length}):*\n\n`;
  upcomingExams.forEach((ex, i) => {
    text += `${i + 1}. *${ex.title}*\n`;
    text += `   • زمان شروع: ${formatJalaliDate(ex.allowedStartDate)} (تایم تهران)\n`;
    text += `   • مدت زمان: ${ex.durationMinutes} دقیقه | تعداد سوالات: ${ex.questionCount}\n\n`;
  });

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

export async function handleShowPreviousResults(ctx) {
  const student = ctx.state.student;
  if (!student) return ctx.reply('❌ لطفاً ابتدا با دستور /login وارد شوید.');

  const results = await getPreviousResultsForStudent(student._id);
  if (!results || results.length === 0) {
    return ctx.reply('📊 هنوز هیچ کارنامه یا نتیجه آزمونی ندارید.');
  }

  let text = `📊 *کارنامه و نتایج آزمون‌های قبلی شما:*\n\n`;
  for (const att of results) {
    const exam = att.examId;
    if (!exam) continue;

    text += `📝 *${exam.title}*\n`;
    text += `  • نمره: *${att.score}* از ${exam.questionCount}\n`;
    text += `  • درصد: *${att.percentage}%*\n`;
    text += `  • رتبه: *#${att.rank || 1}*\n`;
    text += `  • درست: ${att.correctCount} | نادرست: ${att.wrongCount} | نزده: ${att.blankCount}\n\n`;

    // Detailed sheet
    const detail = await getDetailedAttemptResult(att._id);
    if (detail && detail.detailedSheet) {
      text += `  📋 *جزئیات پاسخ‌برگ:*\n`;
      detail.detailedSheet.forEach(q => {
        const icon = q.isCorrect ? '✅' : (q.isBlank ? '⚪' : '❌');
        const ansStr = q.studentOption === 0 ? 'بدون پاسخ' : `گزینه ${q.studentOption}`;
        const displayNum = q.displayQuestionNum || q.questionNum;
        text += `   سوال ${displayNum}: ${icon} پاسخ شما: ${ansStr} | پاسخ صحیح: گزینه ${q.correctOption}\n`;
      });
      text += `\n--------------------------------\n\n`;
    }
  }

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

export async function handleShowRankings(ctx) {
  const student = ctx.state.student;
  if (!student) return ctx.reply('❌ لطفاً ابتدا با دستور /login وارد شوید.');

  const results = await getPreviousResultsForStudent(student._id);
  if (!results || results.length === 0) {
    return ctx.reply('🏆 هنوز رتبه‌بندی آزمونی در دسترس نیست.');
  }

  let text = `🏆 *رتبه‌بندی شما در آزمون‌ها:*\n\n`;
  results.forEach(att => {
    if (att.examId) {
      text += `• *${att.examId.title}:* رتبه *#${att.rank || 1}* (${att.percentage}%)\n`;
    }
  });

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

export async function handleGetAnswerKey(ctx) {
  const student = ctx.state.student;
  if (!student) return ctx.reply('❌ لطفاً ابتدا با /login وارد شوید.');

  const results = await getPreviousResultsForStudent(student._id);
  if (!results || results.length === 0) {
    return ctx.reply('📄 شما هنوز هیچ آزمونی را کامل نکرده‌اید تا پاسخنامه آن را دریافت کنید.');
  }

  const keyboard = new InlineKeyboard();
  results.forEach(att => {
    if (att.examId) {
      keyboard.text(`📄 ${att.examId.title}`, `get_answer_key_${att.examId._id}`).row();
    }
  });

  await ctx.reply('📄 *آزمون‌های تکمیل‌شده شما:*\n\nبرای دریافت پاسخنامه، آزمون مورد نظر را انتخاب کنید:', {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

export async function handleSendAnswerKey(ctx) {
  const student = ctx.state.student;
  if (!student) return ctx.answerCallbackQuery('دسترسی غیرمجاز');

  const examId = ctx.callbackQuery.data.replace('get_answer_key_', '');

  // Verify student has completed this exam
  const results = await getPreviousResultsForStudent(student._id);
  const completed = results.find(att => att.examId && att.examId._id.toString() === examId);

  if (!completed) {
    await ctx.answerCallbackQuery('شما هنوز این آزمون را کامل نکرده‌اید');
    return ctx.reply('❌ شما هنوز این آزمون را کامل نکرده‌اید. فقط پس از اتمام آزمون می‌توانید پاسخنامه را دریافت کنید.');
  }

  const exam = completed.examId;

  if (exam.answerPdfFileId) {
    await ctx.answerCallbackQuery('پاسخنامه ارسال شد');
    await ctx.replyWithDocument(exam.answerPdfFileId, {
      caption: `📄 پاسخنامه آزمون: ${exam.title}`,
    });
  } else if (exam.answerPdfUrl) {
    await ctx.answerCallbackQuery('پاسخنامه ارسال شد');
    await ctx.reply(`📄 لینک پاسخنامه آزمون ${exam.title}:\n${exam.answerPdfUrl}`);
  } else {
    await ctx.answerCallbackQuery('پاسخنامه موجود نیست');
    await ctx.reply('ℹ️ برای این آزمون پاسخنامه PDF ارسال نشده است.');
  }
}

export async function handleStudentLogout(ctx) {
  const student = ctx.state.student;
  if (!student) return ctx.reply('❌ شما وارد حسابی نشده‌اید.');

  const result = await logoutStudent(ctx.from.id.toString());

  if (!result.success) {
    return ctx.reply(`❌ ${result.message}`);
  }

  ctx.state.student = null;
  ctx.state.isStudent = false;
  ctx.state.userRole = 'guest';

  await ctx.reply('🚪 *شما با موفقیت از حساب خود خارج شدید.*\n\nبرای ورود مجدد از دستور /login استفاده کنید.', {
    parse_mode: 'Markdown',
    reply_markup: { remove_keyboard: true },
  });
}
