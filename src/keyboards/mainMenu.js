import { Keyboard, InlineKeyboard } from 'grammy';

export function getAdminMenuKeyboard() {
  return new Keyboard()
    .text('👥 تعریف دانش‌آموز').text('📝 تعریف آزمون جدید').row()
    .text('🗑️ حذف آزمون').text('📊 نتایج همه آزمون‌ها').row()
    .text('👥 لیست دانش‌آموزان').text('❌ حذف دانش‌آموز').row()
    .resized();
}

export function getStudentMenuKeyboard() {
  return new Keyboard()
    .text('📝 آزمون‌های فعال').text('📅 آزمون‌های آینده').row()
    .text('📊 کارنامه و نتایج قبلی').text('🏆 رتبه‌بندی').row()
    .text('🚪 خروج از حساب').row()
    .resized();
}

export function getExamSelectionKeyboard(exams, prefix = 'start_exam') {
  const keyboard = new InlineKeyboard();
  if (!exams || exams.length === 0) {
    return keyboard;
  }

  exams.forEach(exam => {
    keyboard.text(`📝 ${exam.title} (${exam.durationMinutes} دقیقه)`, `${prefix}_${exam._id}`).row();
  });

  return keyboard;
}
