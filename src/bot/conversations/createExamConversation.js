import { parseFlexibleDate, formatJalaliDate } from '../../utils/time.js';
import { getAllStudents } from '../../services/studentService.js';
import { getAllCategories, resolveStudentIdsFromCategories } from '../../services/categoryService.js';
import { createExam } from '../../services/examService.js';

export async function createExamConversation(conversation, ctx) {
  await ctx.reply("📋 *مرحله ۱ از ۱۰: عنوان آزمون*\n\nلطفاً عنوان آزمون را وارد کن جیگر:", { parse_mode: 'Markdown' });
  const titleCtx = await conversation.waitFor('message:text');
  const title = titleCtx.message.text.trim();

  await ctx.reply("📄 *مرحله ۲ از ۱۰: آپلود فایل PDF آزمون*\n\nلطفاً فایل PDF آزمون را ارسال کنید (یا لینک مستقیماً ارسال نمایید):", { parse_mode: 'Markdown' });
  const pdfCtx = await conversation.waitFor(['message:document', 'message:text']);
  
  let pdfFileId = null;
  let pdfFileName = 'exam.pdf';
  let pdfUrl = '';

  if (pdfCtx.message.document) {
    pdfFileId = pdfCtx.message.document.file_id;
    pdfFileName = pdfCtx.message.document.file_name || 'exam.pdf';
  } else if (pdfCtx.message.text) {
    pdfUrl = pdfCtx.message.text.trim();
  }

  await ctx.reply("🔢 *مرحله ۳ از ۱۰: شماره شروع سوالات*\n\nشماره اولین سوال را وارد کنید (مثلاً: 12 - اگر از ۱ شروع می‌شود 1 را وارد کنید):", { parse_mode: 'Markdown' });
  let startQuestionNumber = 0;
  while (startQuestionNumber <= 0) {
    const startNumCtx = await conversation.waitFor('message:text');
    const val = parseInt(startNumCtx.message.text.trim(), 10);
    if (!isNaN(val) && val > 0) {
      startQuestionNumber = val;
    } else {
      await ctx.reply("❌ شماره شروع نامعتبر است. لطفاً یک عدد صحیح مثبت وارد کنید (مثلاً: 1 یا 12):");
    }
  }

  await ctx.reply("🔢 *مرحله ۴ از ۱۰: تعداد سوالات*\n\nتعداد کل سوالات را وارد کنید (مثلاً: 20):", { parse_mode: 'Markdown' });
  let questionCount = 0;
  while (questionCount <= 0) {
    const qCountCtx = await conversation.waitFor('message:text');
    const val = parseInt(qCountCtx.message.text.trim(), 10);
    if (!isNaN(val) && val > 0) {
      questionCount = val;
    } else {
      await ctx.reply("❌ تعداد سوالات نامعتبر است. لطفاً یک عدد صحیح مثبت وارد کنید:");
    }
  }

  await ctx.reply("⏱️ *مرحله ۵ از ۱۰: مدت زمان آزمون*\n\nمدت زمان آزمون را به دقیقه وارد کنید (مثلاً: 90):", { parse_mode: 'Markdown' });
  let durationMinutes = 0;
  while (durationMinutes <= 0) {
    const durCtx = await conversation.waitFor('message:text');
    const val = parseInt(durCtx.message.text.trim(), 10);
    if (!isNaN(val) && val > 0) {
      durationMinutes = val;
    } else {
      await ctx.reply("❌ مدت زمان نامعتبر است. لطفاً عدد مثبت به دقیقه وارد کنید (مثلاً: 90):");
    }
  }

  await ctx.reply("📅 *مرحله ۶ از ۱۰: تاریخ و ساعت شروع مجاز (هجری شمسی - تایم تهران)*\n\nتاریخ و ساعت شروع را وارد کنید (مثلاً: `1405/05/15 08:00` یا `1405-05-15 08:00`):", { parse_mode: 'Markdown' });
  const startCtx = await conversation.waitFor('message:text');
  const allowedStartDate = parseFlexibleDate(startCtx.message.text.trim());

  await ctx.reply("📅 *مرحله ۷ از ۱۰: تاریخ و ساعت پایان مجاز (هجری شمسی - تایم تهران)*\n\nتاریخ و ساعت پایان را وارد کنید (مثلاً: `1405/05/15 20:00` یا `1405-05-15 20:00`):", { parse_mode: 'Markdown' });
  const endCtx = await conversation.waitFor('message:text');
  const allowedEndDate = parseFlexibleDate(endCtx.message.text.trim());

  // Fetch registered students & categories
  const students = await conversation.external(async () => {
    const docs = await getAllStudents();
    return docs.map(d => ({
      _id: d._id.toString(),
      fullName: d.fullName,
      username: d.username,
    }));
  });

  const categories = await conversation.external(async () => {
    const docs = await getAllCategories();
    return docs.map(d => ({
      _id: d._id.toString(),
      name: d.name,
      studentCount: d.studentIds ? d.studentIds.length : 0,
    }));
  });

  if (!students || students.length === 0) {
    await ctx.reply("⚠️ هنوز هیچ دانش‌آموزی ثبت نام نشده است. ابتدا از منوی مدیریت دانش‌آموز ایجاد کنید.");
    return;
  }

  let allowedText = `👥 *مرحله ۸ از ۱۰: دانش‌آموزان و دسته‌بندی‌های مجاز*\n\n`;

  if (categories && categories.length > 0) {
    allowedText += `🏷️ *دسته‌بندی‌های موجود:*\n`;
    allowedText += categories.map((c, idx) => `  ${idx + 1}. ${c.name} (${c.studentCount} دانش‌آموز)`).join('\n');
    allowedText += `\n\n👥 *دانش‌آموزان دیگر:*\n`;
  } else {
    allowedText += `🏷️ هیچ دسته‌بندی‌ای تعریف نشده است.\n\n👥 *دانش‌آموزان:*\n`;
  }

  allowedText += students.map((s, idx) => `${categories.length + idx + 1}. ${s.fullName} (@${s.username})`).join('\n');
  allowedText += `\n\nبرای انتخاب، موارد زیر را ارسال کنید:\n`;
  allowedText += `- شماره دسته‌بندی یا دانش‌آموز با کاما: \`1,2,5\`\n`;
  allowedText += `- \`ALL\` برای همه\n`;
  allowedText += `- تلفیقی از نام کاربری و شماره: \`1, ali, 2\``;

  await ctx.reply(allowedText, { parse_mode: 'Markdown' });

  let allowedStudentIds = [];
  let allowedCategoryIds = [];

  while (allowedStudentIds.length === 0 && allowedCategoryIds.length === 0) {
    const studCtx = await conversation.waitFor('message:text');
    const studInput = studCtx.message.text.trim();

    if (studInput.toUpperCase() === 'ALL') {
      allowedStudentIds = students.map(s => s._id);
      allowedCategoryIds = categories.map(c => c._id);
    } else {
      const parts = studInput.replace(/@/g, '').replace(/،/g, ',').split(',');
      for (const part of parts) {
        const p = part.trim();
        if (!p) continue;

        // Check if it's a number (category or student index)
        const num = parseInt(p, 10);
        if (!isNaN(num) && num > 0) {
          if (categories && num <= categories.length) {
            allowedCategoryIds.push(categories[num - 1]._id);
          } else {
            const studIdx = num - categories.length;
            if (studIdx > 0 && studIdx <= students.length) {
              allowedStudentIds.push(students[studIdx - 1]._id);
            }
          }
        } else {
          // It's a username
          const student = students.find(s => s.username.toLowerCase() === p.toLowerCase());
          if (student) {
            allowedStudentIds.push(student._id);
          }
        }
      }

      allowedCategoryIds = [...new Set(allowedCategoryIds)];
      allowedStudentIds = [...new Set(allowedStudentIds)];
    }

    if (allowedStudentIds.length === 0 && allowedCategoryIds.length === 0) {
      await ctx.reply("⚠️ هیچ مورد معتبری یافت نشد. لطفاً دوباره تلاش کنید یا ALL را بفرستید:");
    }
  }

  await ctx.reply(
    `🔑 *مرحله ۹ از ۱۰: کلید پاسخ‌ها*\n\n` +
    `فقط اعداد (1, 2, 3, 4) را ارسال کنید - در هر سطر یک عدد.\n` +
    `تعداد گزینه‌ها باید دقیقاً برابر با تعداد سوالات (${questionCount}) باشد.\n\n` +
    `مثال:\n1\n2\n4\n3\n2...`,
    { parse_mode: 'Markdown' }
  );

  let answerKey = [];
  while (answerKey.length !== questionCount) {
    const keyCtx = await conversation.waitFor('message:text');
    const lines = keyCtx.message.text.trim().split(/\r?\n/).map(l => parseInt(l.trim(), 10)).filter(n => !isNaN(n));

    if (lines.length === questionCount && lines.every(n => n >= 1 && n <= 4)) {
      answerKey = lines;
    } else {
      await ctx.reply(
        `❌ کلید پاسخ‌ها نامعتبر است! تعداد گزینه‌های دریافتی: ${lines.length}. مورد نیاز: ${questionCount}.\n` +
        `تمام گزینه‌ها باید اعداد بین ۱ تا ۴ باشند.\n\nلطفاً دوباره ارسال کنید:`
      );
    }
  }

  await ctx.reply("📄 *مرحله ۱۰ از ۱۰: آپلود فایل PDF پاسخنامه*\n\nلطفاً فایل PDF پاسخنامه را ارسال کنید (یا لینک مستقیماً ارسال نمایید):", { parse_mode: 'Markdown' });
  const answerPdfCtx = await conversation.waitFor(['message:document', 'message:text']);

  let answerPdfFileId = null;
  let answerPdfFileName = 'answer-key.pdf';
  let answerPdfUrl = '';

  if (answerPdfCtx.message.document) {
    answerPdfFileId = answerPdfCtx.message.document.file_id;
    answerPdfFileName = answerPdfCtx.message.document.file_name || 'answer-key.pdf';
  } else if (answerPdfCtx.message.text) {
    answerPdfUrl = answerPdfCtx.message.text.trim();
  }

  // Calculate total allowed students (individual + category members, without duplicates)
  const totalAllowedCount = await conversation.external(async () => {
    const categoryStudentIds = await resolveStudentIdsFromCategories(allowedCategoryIds);
    const merged = new Set([...allowedStudentIds, ...categoryStudentIds]);
    return merged.size;
  });

  // Summary & Confirmation
  const summary = 
    `📝 *تأیید ساخت آزمون جدید*\n\n` +
    `*عنوان:* ${title}\n` +
    `*شماره شروع سوالات:* ${startQuestionNumber}\n` +
    `*تعداد سوالات:* ${questionCount}\n` +
    `*مدت زمان:* ${durationMinutes} دقیقه\n` +
    `*زمان شروع:* ${formatJalaliDate(allowedStartDate)} (تایم تهران)\n` +
    `*زمان پایان:* ${formatJalaliDate(allowedEndDate)} (تایم تهران)\n` +
    `*دانش‌آموزان مجاز:* ${totalAllowedCount} نفر\n` +
    `*کلید پاسخ‌ها:* ${answerKey.join(', ')}\n` +
    `*پاسخنامه PDF:* ${answerPdfFileId ? 'فایل ارسال شد' : (answerPdfUrl || 'ارسال نشد')}\n\n` +
    `⚠️ *مهم:* پس از تأیید، این آزمون قفل شده (غیرقابل تغییر) می‌شود.`;

  await ctx.reply(summary, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ تأیید و ساخت آزمون', callback_data: 'create_exam_confirm' }],
        [{ text: '❌ انصراف', callback_data: 'create_exam_cancel' }]
      ]
    }
  });

  const confirmCtx = await conversation.waitFor('callback_query:data');
  if (confirmCtx.callbackQuery.data === 'create_exam_confirm') {
    await conversation.external(async () => {
      await createExam({
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
        createdBy: ctx.from.id.toString(),
      });
    });

    await confirmCtx.answerCallbackQuery('آزمون ساخته شد!');
    await confirmCtx.reply('✅ *آزمون با موفقیت ایجاد و قفل شد (Immutable)!*', { parse_mode: 'Markdown' });
  } else {
    await confirmCtx.answerCallbackQuery('لغو شد');
    await confirmCtx.reply('❌ ساخت آزمون لغو شد.');
  }
}
