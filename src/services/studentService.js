import { Student } from '../models/Student.js';

export async function createStudent(fullName, username, password) {
  const existing = await Student.findOne({ username: username.toLowerCase() });
  if (existing) {
    throw new Error(`Student with username "${username}" already exists.`);
  }

  const student = new Student({
    fullName: fullName.trim(),
    username: username.toLowerCase().trim(),
    password: password.trim(),
  });

  await student.save();
  return student;
}

export async function getStudentByUsername(username) {
  if (!username) return null;
  return await Student.findOne({ username: username.toLowerCase().trim() });
}

export async function getStudentByTelegramId(telegramId) {
  if (!telegramId) return null;
  return await Student.findOne({ telegramId: String(telegramId) });
}

export async function linkStudentTelegramId(username, password, telegramId) {
  const student = await Student.findOne({ username: username.toLowerCase().trim() });
  
  if (!student) {
    return { success: false, message: 'Invalid username or password.' };
  }

  if (student.password !== password.trim()) {
    return { success: false, message: 'Invalid username or password.' };
  }

  // Check if this telegramId is already linked to another student
  const existingLink = await Student.findOne({ telegramId: String(telegramId) });
  if (existingLink && existingLink._id.toString() !== student._id.toString()) {
    return { 
      success: false, 
      message: `Your Telegram ID is already linked to student "${existingLink.fullName}".` 
    };
  }

  student.telegramId = String(telegramId);
  student.isLinked = true;
  await student.save();

  return {
    success: true,
    student,
    message: `Account linked successfully! Welcome ${student.fullName}.`
  };
}

export async function getAllStudents() {
  return await Student.find({}).sort({ fullName: 1 });
}

export async function logoutStudent(telegramId) {
  const student = await Student.findOne({ telegramId: String(telegramId) });
  if (!student) return { success: false, message: 'No linked account found.' };

  student.telegramId = null;
  student.isLinked = false;
  await student.save();

  return { success: true, message: 'You have been logged out successfully.' };
}

export async function deleteStudent(studentId) {
  const { ExamAttempt } = await import('../models/ExamAttempt.js');
  const { Exam } = await import('../models/Exam.js');

  // 1. Delete all exam attempts for this student
  await ExamAttempt.deleteMany({ studentId });

  // 2. Remove student from allowedStudentIds of all exams
  await Exam.updateMany(
    { allowedStudentIds: studentId },
    { $pull: { allowedStudentIds: studentId } }
  );

  // 3. Delete the student record
  const result = await Student.findByIdAndDelete(studentId);
  return result;
}
