import { createCategory } from '../../services/categoryService.js';

export async function createCategoryConversation(conversation, ctx) {
  await ctx.reply(
    `🏷️ *تعریف دسته‌بندی جدید*\n\n` +
    `لطفاً نام دسته‌بندی را وارد کنید (مثلاً: گروه ریاضی):`,
    { parse_mode: 'Markdown' }
  );

  const nameCtx = await conversation.waitFor('message:text');
  const name = nameCtx.message.text.trim();

  if (!name) {
    await ctx.reply('❌ نام دسته‌بندی نمی‌تواند خالی باشد.');
    return;
  }

  try {
    const category = await conversation.external(async () => {
      const doc = await createCategory(name);
      const studentCount = doc.studentIds ? doc.studentIds.length : 0;
      return {
        _id: doc._id.toString(),
        name: doc.name,
        studentCount,
      };
    });

    await ctx.reply(
      `✅ *دسته‌بندی با موفقیت ایجاد شد!*\n\n` +
      `🏷️ *نام:* ${category.name}\n` +
      `👥 *تعداد اعضا:* ${category.studentCount}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    await ctx.reply(`❌ خطا در ایجاد دسته‌بندی: ${error.message}`);
  }
}