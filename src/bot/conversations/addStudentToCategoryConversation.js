import { getAllCategories, addStudentsToCategory } from '../../services/categoryService.js';
import { getAllStudents } from '../../services/studentService.js';

export async function addStudentToCategoryConversation(conversation, ctx) {
  const categories = await conversation.external(async () => {
    const docs = await getAllCategories();
    return docs.map(d => ({
      _id: d._id.toString(),
      name: d.name,
      studentCount: d.studentIds ? d.studentIds.length : 0,
    }));
  });

  if (!categories || categories.length === 0) {
    await ctx.reply('⚠️ هنوز هیچ دسته‌بندی‌ای تعریف نشده است. ابتدا از منوی «🏷️ دسته‌بندی جدید» یک دسته بسازید.');
    return;
  }

  await ctx.reply(
    `📂 *افزودن دانش‌آموز به دسته‌بندی*\n\n` +
    `دسته‌بندی‌های موجود:\n` +
    categories.map((c, idx) => `${idx + 1}. ${c.name} (${c.studentCount} دانش‌آموز)`).join('\n') +
    `\n\nلطفاً نام دسته‌بندی مورد نظر را ارسال کنید:`,
    { parse_mode: 'Markdown' }
  );

  const catCtx = await conversation.waitFor('message:text');
  const catInput = catCtx.message.text.trim().toLowerCase();

  const selectedCategory = categories.find(c => c.name.toLowerCase() === catInput);
  if (!selectedCategory) {
    await ctx.reply('❌ دسته‌بندی با این نام یافت نشد. لطفاً نام دقیق دسته‌بندی را ارسال کنید:');
    return;
  }

  const students = await conversation.external(async () => {
    const docs = await getAllStudents();
    return docs.map(d => ({
      _id: d._id.toString(),
      fullName: d.fullName,
      username: d.username,
    }));
  });

  if (!students || students.length === 0) {
    await ctx.reply('⚠️ هنوز هیچ دانش‌آموزی ثبت نشده است. ابتدا دانش‌آموز تعریف کنید.');
    return;
  }

  await ctx.reply(
    `👥 *انتخاب دانش‌آموزان برای دسته «${selectedCategory.name}»*\n\n` +
    `دانش‌آموزان موجود:\n` +
    students.map((s, idx) => `${idx + 1}. ${s.fullName} (@${s.username})`).join('\n') +
    `\n\nعبارت \`ALL\` را برای افزودن همه دانش‌آموزان ارسال کنید، یا شماره دانش‌آموزان را با کاما جدا کنید (مثلاً: \`1,3,5\`):`,
    { parse_mode: 'Markdown' }
  );

  const studCtx = await conversation.waitFor('message:text');
  const studInput = studCtx.message.text.trim();

  let selectedStudentIds = [];

  if (studInput.toUpperCase() === 'ALL') {
    selectedStudentIds = students.map(s => s._id);
  } else {
    const numbers = studInput.replace(/،/g, ',').split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n) && n > 0 && n <= students.length);
    selectedStudentIds = numbers.map(n => students[n - 1]._id);
  }

  if (selectedStudentIds.length === 0) {
    await ctx.reply('❌ هیچ دانش‌آموز معتبری انتخاب نشد. عملیات لغو شد.');
    return;
  }

  const result = await conversation.external(async () => {
    const doc = await addStudentsToCategory(selectedCategory._id, selectedStudentIds);
    const totalMembers = doc.category.studentIds.length;
    return {
      added: doc.added,
      totalMembers,
    };
  });

  await ctx.reply(
    `✅ *${result.added} دانش‌آموز به دسته «${selectedCategory.name}» اضافه شد!*\n\n` +
    `👥 مجموع اعضای دسته: ${result.totalMembers}`,
    { parse_mode: 'Markdown' }
  );
}