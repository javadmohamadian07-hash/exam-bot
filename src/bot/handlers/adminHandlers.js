import { createStudent, getAllStudents, deleteStudent } from '../../services/studentService.js';
import { getAllExams, deleteExam, getExamResultsForAdmin } from '../../services/examService.js';
import { getAllCategories, deleteCategory } from '../../services/categoryService.js';
import { InlineKeyboard } from 'grammy';

export async function handleCreateStudentStart(ctx) {
  if (!ctx.state.isAdmin) {
    return ctx.reply('❌ دسترسی مدیر لازم است.');
  }
  ctx.session.adminState = { step: 'awaiting_student_info' };
  await ctx.reply(
    `👥 *تعریف دانش‌آموز جدید*\n\n` +
    `لطفاً اطلاعات دانش‌آموز را به فرمت زیر ارسال کن جیگر:\n` +
    `\`نام کامل | نام کاربری | کلمه عبور\`\n\n` +
    `مثال:\n` +
    `\`علی احمدی | ali | 123456\``,
    { parse_mode: 'Markdown' }
  );
}

export async function handleProcessStudentCreation(ctx) {
  if (!ctx.session.adminState || ctx.session.adminState.step !== 'awaiting_student_info') {
    return false;
  }

  const text = ctx.message.text.trim();
  const parts = text.split('|').map(p => p.trim());

  if (parts.length < 3) {
    await ctx.reply('❌ فرمت ورودی نامعتبر است. لطفاً به این صورت ارسال کنید: `نام کامل | نام کاربری | کلمه عبور`', { parse_mode: 'Markdown' });
    return true;
  }

  const [fullName, username, password] = parts;

  try {
    const student = await createStudent(fullName, username, password);
    ctx.session.adminState = null;
    console.log('دانش اموز ایجاد شد');
    await ctx.reply(
      `✅ *دانش‌آموز با موفقیت ایجاد شد!*\n\n` +
      `👤 *نام:* ${student.fullName}\n` +
      `🔑 *نام کاربری:* \`${student.username}\`\n` +
      `🔒 *کلمه عبور:* \`${student.password}\`\n\n` +
      `دانش‌آموز اکنون می‌تواند با این اطلاعات وارد ربات شود.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    await ctx.reply(`❌ خطا در ایجاد دانش‌آموز: ${error.message}`);
  }

  return true;
}

export async function handleListStudents(ctx) {
  if (!ctx.state.isAdmin) return ctx.reply('❌ دسترسی مدیر لازم است.');

  const students = await getAllStudents();
  if (!students || students.length === 0) {
    return ctx.reply('ℹ️ هیچ دانش‌آموزی در پایگاه داده یافت نشد.');
  }

  let text = `👥 *دانش‌آموزان ثبت‌شده (${students.length} نفر):*\n\n`;
  students.forEach((s, i) => {
    const status = s.isLinked ? `✅ متصل به تلگرام (شناسه: ${s.telegramId})` : '⏳ متصل نشده';
    text += `${i + 1}. *${s.fullName}*\n   نام کاربری: \`${s.username}\` | کلمه عبور: \`${s.password}\`\n   وضعیت: ${status}\n\n`;
  });

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

export async function handleDeleteExamPrompt(ctx) {
  if (!ctx.state.isAdmin) return ctx.reply('❌ دسترسی مدیر لازم است.');

  const exams = await getAllExams();
  if (!exams || exams.length === 0) {
    return ctx.reply('ℹ️ هیچ آزمونی برای حذف وجود ندارد.');
  }

  const keyboard = new InlineKeyboard();
  exams.forEach(exam => {
    keyboard.text(`🗑️ حذف: ${exam.title}`, `delete_exam_${exam._id}`).row();
  });

  await ctx.reply('🗑️ *آزمون مورد نظر برای حذف دائمی را انتخاب کنید:*', {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

export async function handleConfirmDeleteExam(ctx) {
  if (!ctx.state.isAdmin) return ctx.answerCallbackQuery('دسترسی غیرمجاز');

  const examId = ctx.callbackQuery.data.replace('delete_exam_', '');
  await deleteExam(examId);

  await ctx.answerCallbackQuery('آزمون حذف شد');
  await ctx.editMessageText('✅ *آزمون و تمام پاسخ‌برگ‌های مربوطه با موفقیت حذف شدند.*', { parse_mode: 'Markdown' });
}

export async function handleViewAllResultsPrompt(ctx) {
  if (!ctx.state.isAdmin) return ctx.reply('❌ دسترسی مدیر لازم است.');

  const exams = await getAllExams();
  if (!exams || exams.length === 0) {
    return ctx.reply('ℹ️ هنوز آزمونی تعریف نشده است.');
  }

  const keyboard = new InlineKeyboard();
  exams.forEach(exam => {
    keyboard.text(`📊 نتایج: ${exam.title}`, `view_results_${exam._id}`).row();
  });

  await ctx.reply('📊 *برای مشاهده نتایج دانش‌آموزان، آزمون مورد نظر را انتخاب کنید:*', {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

export async function handleShowAdminExamResults(ctx) {
  if (!ctx.state.isAdmin) return ctx.answerCallbackQuery('دسترسی غیرمجاز');

  const examId = ctx.callbackQuery.data.replace('view_results_', '');
  const resultData = await getExamResultsForAdmin(examId);

  if (!resultData || !resultData.exam) {
    return ctx.answerCallbackQuery('آزمون یافت نشد');
  }

  const { exam, attempts } = resultData;

  let text = `📊 *نتایج آزمون: ${exam.title}*\n`;
  text += `تعداد سوالات: ${exam.questionCount} | مدت زمان: ${exam.durationMinutes} دقیقه\n\n`;

  if (!attempts || attempts.length === 0) {
    text += `ℹ️ هنوز هیچ دانش‌آموزی این آزمون را کامل نکرده است.`;
  } else {
    text += `🏆 *جدول رتبه‌بندی دانش‌آموزان:*\n\n`;
    attempts.forEach((att, idx) => {
      const studentName = att.studentId ? att.studentId.fullName : 'نامشخص';
      text += `*رتبه #${att.rank || idx + 1}:* ${studentName}\n`;
      text += `  • نمره: *${att.score}* از ${exam.questionCount}\n`;
      text += `  • درصد: *${att.percentage}%*\n`;
      text += `  • درست: ${att.correctCount} | نادرست: ${att.wrongCount} | نزده: ${att.blankCount}\n\n`;
    });
  }

  await ctx.answerCallbackQuery();
  await ctx.reply(text, { parse_mode: 'Markdown' });
}

export async function handleDeleteCategoryPrompt(ctx) {
  if (!ctx.state.isAdmin) return ctx.reply('❌ دسترسی مدیر لازم است.');

  const categories = await getAllCategories();
  if (!categories || categories.length === 0) {
    return ctx.reply('ℹ️ هیچ دسته‌بندی برای حذف وجود ندارد.');
  }

  const keyboard = new InlineKeyboard();
  categories.forEach(cat => {
    keyboard.text(`🗑️ ${cat.name} (${cat.studentIds.length} دانش‌آموز)`, `delete_category_${cat._id}`).row();
  });

  await ctx.reply('🗑️ *دسته‌بندی مورد نظر برای حذف دائمی را انتخاب کنید:*', {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

export async function handleConfirmDeleteCategory(ctx) {
  if (!ctx.state.isAdmin) return ctx.answerCallbackQuery('دسترسی غیرمجاز');

  const categoryId = ctx.callbackQuery.data.replace('delete_category_', '');
  await deleteCategory(categoryId);

  await ctx.answerCallbackQuery('دسته‌بندی حذف شد');
  await ctx.editMessageText('✅ *دسته‌بندی با موفقیت حذف شد.*\n\nتوجه: دانش‌آموزان دسته حذف نمی‌شوند و فقط از این دسته خارج می‌شوند.', { parse_mode: 'Markdown' });
}

export async function handleDeleteStudentPrompt(ctx) {
  if (!ctx.state.isAdmin) return ctx.reply('❌ دسترسی مدیر لازم است.');

  const students = await getAllStudents();
  if (!students || students.length === 0) {
    return ctx.reply('ℹ️ هیچ دانش‌آموزی برای حذف وجود ندارد.');
  }

  const keyboard = new InlineKeyboard();
  students.forEach(student => {
    keyboard.text(`❌ ${student.fullName} (${student.username})`, `delete_student_${student._id}`).row();
  });

  await ctx.reply('❌ *دانش‌آموز مورد نظر برای حذف دائمی را انتخاب کنید:*\n\n⚠️ با حذف دانش‌آموز، تمام تلاش‌های آزمون و نتایج او نیز پاک می‌شود.', {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
}

export async function handleConfirmDeleteStudent(ctx) {
  if (!ctx.state.isAdmin) return ctx.answerCallbackQuery('دسترسی غیرمجاز');

  const studentId = ctx.callbackQuery.data.replace('delete_student_', '');
  const student = await deleteStudent(studentId);

  if (!student) {
    await ctx.answerCallbackQuery('دانش‌آموز یافت نشد');
    return ctx.editMessageText('❌ دانش‌آموز مورد نظر یافت نشد.');
  }

  await ctx.answerCallbackQuery('دانش‌آموز حذف شد');
  await ctx.editMessageText(
    `✅ *دانش‌آموز "${student.fullName}" و تمام داده‌های مرتبط با موفقیت حذف شدند.*\n\n` +
    `📌 تلاش‌های آزمون و نتایج: پاک شد\n` +
    `📌 دسترسی به آزمون‌ها: لغو شد`,
    { parse_mode: 'Markdown' }
  );
}
