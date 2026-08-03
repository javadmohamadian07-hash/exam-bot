/**
 * Exam scoring calculator according to rules:
 * Correct answer = +1
 * Wrong answer = -1/3
 * Blank/Unanswered = 0
 */

export function calculateExamScore(studentAnswersMap, answerKey) {
  let correctCount = 0;
  let wrongCount = 0;
  let blankCount = 0;

  const totalQuestions = answerKey.length;

  for (let i = 0; i < totalQuestions; i++) {
    const qNum = i + 1;
    const correctAnswer = answerKey[i];
    const studentAnswer = studentAnswersMap.get(qNum) || 0; // 0 = blank

    if (studentAnswer === 0) {
      blankCount++;
    } else if (studentAnswer === correctAnswer) {
      correctCount++;
    } else {
      wrongCount++;
    }
  }

  const rawScore = (correctCount * 1) - (wrongCount * (1 / 3));
  const maxPossibleScore = totalQuestions * 1;
  
  // Percentage formula
  let percentage = (rawScore / maxPossibleScore) * 100;
  percentage = Math.round(percentage * 100) / 100; // Round to 2 decimals

  return {
    correctCount,
    wrongCount,
    blankCount,
    totalQuestions,
    score: Math.round(rawScore * 100) / 100,
    percentage,
  };
}
