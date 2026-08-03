import { config } from '../../config/env.js';
import { getStudentByTelegramId } from '../../services/studentService.js';

export async function authMiddleware(ctx, next) {
  if (!ctx.from) return await next();

  const telegramId = String(ctx.from.id);

  ctx.state = ctx.state || {};

  // Check if Admin
  if (config.adminTelegramIds.includes(telegramId)) {
    ctx.state.userRole = 'admin';
    ctx.state.isAdmin = true;
    return await next();
  }

  // Check if Student
  const student = await getStudentByTelegramId(telegramId);
  if (student) {
    ctx.state.userRole = 'student';
    ctx.state.student = student;
    ctx.state.isStudent = true;
    return await next();
  }

  // Otherwise Guest
  ctx.state.userRole = 'guest';
  ctx.state.isGuest = true;
  return await next();
}
