import { parseFlexibleDate, formatJalaliDate } from '../../utils/time.js';
import { getAllStudents } from '../../services/studentService.js';
import { createExam } from '../../services/examService.js';

export async function createExamConversation(conversation, ctx) {
  await ctx.reply("📋 *مرحله ۱ از ۸: عنوان آزمون*\n\nلطفاً عنوان آزمون را وارد کن جیگر:", { parse_mode: 'Markdown' });
  const titleCtx = await conversation.waitFor('message:text');
  const title = titleCtx.message.text.trim();

  await ctx.reply("📄 *مرحله ۲ از ۸: آپلود فایل PDF آزمون*\n\nلطفاً فایل PDF آزمون را ارسال کنید (یا لینک مستقیماً ارسال نمایید):", { parse_mode: 'Markdown' });
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

  await ctx.reply("🔢 *مرحله ۳ از ۸: تعداد سوالات*\n\nتعداد کل سوالات را وارد کنید (مثلاً: 20):", { parse_mode: 'Markdown' });
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

  await ctx.reply("⏱️ *مرحله ۴ از ۸: مدت زمان آزمون*\n\nمدت زمان آزمون را به دقیقه وارد کنید (مثلاً: 90):", { parse_mode: 'Markdown' });
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

  await ctx.reply("📅 *مرحله ۵ از ۸: تاریخ و ساعت شروع مجاز (هجری شمسی - تایم تهران)*\n\nتاریخ و ساعت شروع را وارد کنید (مثلاً: `1404/05/15 08:00` یا `1404-05-15 08:00`):", { parse_mode: 'Markdown' });
  const startCtx = await conversation.waitFor('message:text');
  const allowedStartDate = parseFlexibleDate(startCtx.message.text.trim());

  await ctx.reply("📅 *مرحله ۶ از ۸: تاریخ و ساعت پایان مجاز (هجری شمسی - تایم تهران)*\n\nتاریخ و ساعت پایان را وارد کنید (مثلاً: `1404/05/15 20:00` یا `1404-05-15 20:00`):", { parse_mode: 'Markdown' });
  const endCtx = await conversation.waitFor('message:text');
  const allowedEndDate = parseFlexibleDate(endCtx.message.text.trim());

  // Fetch registered students
  const students = await conversation.external(async () => {
    const docs = await getAllStudents();
    return docs.map(d => ({
      _id: d._id.toString(),
      fullName: d.fullName,
      username: d.username,
    }));
  });
  if (!students || students.length === 0) {
    await ctx.reply("⚠️ هنوز هیچ دانش‌آموزی ثبت نام نشده است. ابتدا از منوی مدیریت دانش‌آموز ایجاد کنید.");
    return;
  }

  await ctx.reply(`👥 *مرحله ۷ از ۸: دانش‌آموزان مجاز*\n\nدانش‌آموزان موجود:\n` + 
    students.map((s, idx) => `${idx + 1}. ${s.fullName} (@${s.username})`).join('\n') + 
    `\n\nعبارت \`ALL\` را برای تخصیص به همه دانش‌آموزان ارسال کنید، یا نام‌های کاربری را با کاما جدا کنید (مثلاً: \`@ali, reza\`):`, 
    { parse_mode: 'Markdown' }
  );

  let allowedStudentIds = [];
  while (allowedStudentIds.length === 0) {
    const studCtx = await conversation.waitFor('message:text');
    const studInput = studCtx.message.text.trim();

    if (studInput.toUpperCase() === 'ALL') {
      allowedStudentIds = students.map(s => s._id);
    } else {
      const raw = studInput.replace(/@/g, '').replace(/،/g, ',');
      const usernames = raw.split(',').map(u => u.trim().toLowerCase()).filter(Boolean);
      allowedStudentIds = students.filter(s => usernames.includes(s.username.toLowerCase())).map(s => s._id);
    }

    if (allowedStudentIds.length === 0) {
      await ctx.reply("⚠️ هیچ دانش‌آموزی با نام‌های وارد شده یافت نشد. لطفاً دوباره تلاش کنید یا ALL را بفرستید:");
    }
  }

  await ctx.reply(
    `🔑 *مرحله ۸ از ۸: کلید پاسخ‌ها*\n\n` +
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

  // Summary & Confirmation
  const summary = 
    `📝 *تأیید ساخت آزمون جدید*\n\n` +
    `*عنوان:* ${title}\n` +
    `*تعداد سوالات:* ${questionCount}\n` +
    `*مدت زمان:* ${durationMinutes} دقیقه\n` +
    `*زمان شروع:* ${formatJalaliDate(allowedStartDate)} (تایم تهران)\n` +
    `*زمان پایان:* ${formatJalaliDate(allowedEndDate)} (تایم تهران)\n` +
    `*دانش‌آموزان مجاز:* ${allowedStudentIds.length} نفر\n` +
    `*کلید پاسخ‌ها:* ${answerKey.join(', ')}\n\n` +
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
        questionCount,
        durationMinutes,
        allowedStartDate,
        allowedEndDate,
        allowedStudentIds,
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
