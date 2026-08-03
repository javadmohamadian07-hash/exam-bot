import { InlineKeyboard, Keyboard } from 'grammy';

/**
 * Creates inline keyboard for a specific question
 * @param {string} attemptId 
 * @param {number} questionNum 
 * @param {number} selectedOption 1-4 or 0 (blank)
 * @param {boolean} isMarked 
 * @returns {InlineKeyboard}
 */
export function getQuestionKeyboard(attemptId, questionNum, selectedOption = 0, isMarked = false) {
  const keyboard = new InlineKeyboard();

  const opt1 = selectedOption === 1 ? '✅ ①' : '①';
  const opt2 = selectedOption === 2 ? '✅ ②' : '②';
  const opt3 = selectedOption === 3 ? '✅ ③' : '③';
  const opt4 = selectedOption === 4 ? '✅ ④' : '④';

  keyboard
    .text(opt1, `ans:${attemptId}:${questionNum}:1`)
    .text(opt2, `ans:${attemptId}:${questionNum}:2`)
    .text(opt3, `ans:${attemptId}:${questionNum}:3`)
    .text(opt4, `ans:${attemptId}:${questionNum}:4`)
    .row();

  const markBtnText = isMarked ? '📍 برداشتن نشان‌گذاری' : '📌 نشان‌گذاری سوال';
  const noAnswerText = selectedOption === 0 ? '⚪ بدون پاسخ (انتخاب شده)' : '⚪ بدون پاسخ';

  keyboard
    .text(noAnswerText, `ans:${attemptId}:${questionNum}:0`)
    .text(markBtnText, `mark:${attemptId}:${questionNum}`)
    .row();

  return keyboard;
}

/**
 * Main toolbar keyboard visible during exam
 * @returns {Keyboard}
 */
export function getExamToolbarKeyboard() {
  return new Keyboard()
    .text('⏳ زمان باقی‌مانده').text('📄 دریافت مجدد PDF').row()
    .text('📌 سوالات نشان‌دار').text('❓ سوالات بدون پاسخ').row()
    .text('✅ پایان و ثبت آزمون')
    .resized();
}

/**
 * Show Answer Sheet action button (sent after PDF)
 * @param {string} attemptId 
 * @param {string} examId 
 */
export function getStartAnswerSheetKeyboard(attemptId, examId) {
  return new InlineKeyboard()
    .text('📋 نمایش پاسخ‌برگ', `show_sheet:${attemptId}:${examId}`)
    .row();
}

/**
 * Confirm Finish Exam keyboard
 * @param {string} attemptId 
 */
export function getConfirmFinishKeyboard(attemptId) {
  return new InlineKeyboard()
    .text('بله، آزمون به پایان برسد ✅', `confirm_finish:${attemptId}`)
    .row()
    .text('❌ انصراف و ادامه آزمون', `cancel_finish:${attemptId}`)
    .row();
}
