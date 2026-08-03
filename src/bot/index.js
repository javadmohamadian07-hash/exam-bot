import { Bot, session } from 'grammy';
import { conversations, createConversation } from '@grammyjs/conversations';
import { hydrate } from '@grammyjs/hydrate';
import { Api } from 'grammy';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { config } from '../config/env.js';
import { authMiddleware } from './middlewares/auth.js';
import { getAdminMenuKeyboard, getStudentMenuKeyboard } from '../keyboards/mainMenu.js';

import { createExamConversation } from './conversations/createExamConversation.js';

import { 
  handleCreateStudentStart, 
  handleProcessStudentCreation, 
  handleListStudents, 
  handleDeleteExamPrompt, 
  handleConfirmDeleteExam, 
  handleViewAllResultsPrompt, 
  handleShowAdminExamResults,
  handleDeleteStudentPrompt,
  handleConfirmDeleteStudent
} from './handlers/adminHandlers.js';

import { 
  handleStudentLoginPrompt, 
  handleProcessStudentLogin, 
  handleShowActiveExams, 
  handleShowUpcomingExams, 
  handleShowPreviousResults, 
  handleShowRankings,
  handleStudentLogout
} from './handlers/studentHandlers.js';

import { 
  handleSelectExam, 
  handleShowAnswerSheet, 
  handleAnswerSelection, 
  handleToggleMark, 
  handleCheckRemainingTime, 
  handleShowMarkedQuestions, 
  handleShowUnansweredQuestions, 
  handleRedownloadPDF, 
  handleFinishExamPrompt, 
  handleConfirmFinish, 
  handleCancelFinish 
} from './handlers/examInteractionHandlers.js';

export function createTelegramBot(token = config.botToken, useProxy = true) {
  // If no token, return dummy bot object that logs warning
  if (!token) {
    console.log('⚠️ TELEGRAM_BOT_TOKEN not provided. Bot running in Web Simulator mode.');
    return null;
  }

  // Configure proxy if provided and useProxy is true
  let botConfig = {};
  if (config.proxyUrl && useProxy) {
    const maskedUrl = config.proxyUrl.replace(/\/\/.*@/, '//***@');
    console.log(`[PROXY] Using proxy: ${maskedUrl}`);
    
    let proxyAgent;
    if (config.proxyUrl.startsWith('socks')) {
      proxyAgent = new SocksProxyAgent(config.proxyUrl);
    } else {
      proxyAgent = new HttpsProxyAgent(config.proxyUrl);
    }
    
    botConfig = {
      client: {
        baseFetchConfig: {
          agent: proxyAgent,
        },
      },
    };
  } else if (config.proxyUrl && !useProxy) {
    console.log('[PROXY] Proxy available but fallback mode active — connecting directly.');
  } else {
    console.log('[PROXY] No proxy configured. If you are in Iran, the bot may not connect.');
  }

  const bot = new Bot(token, botConfig);

  // Plugins
  bot.use(hydrate());
  bot.use(session({ initial: () => ({ adminState: null, loginState: null }) }));
  bot.use(conversations());

  // Register conversations
  bot.use(createConversation(createExamConversation));

  // Custom Auth Middleware
  bot.use(authMiddleware);

  // Commands
  bot.command('start', async (ctx) => {
    if (ctx.state.isAdmin) {
      await ctx.reply(`👑 *به پنل مدیریت ربات آزمون خوش آمدی عشقم!*\nاز منوی زیر برای مدیریت دانش‌آموزان و آزمون‌ها استفاده کنید:`, {
        parse_mode: 'Markdown',
        reply_markup: getAdminMenuKeyboard(),
      });
    } else if (ctx.state.isStudent) {
      await ctx.reply(`👋 *سلام ${ctx.state.student.fullName} عزیز!*\nبه سیستم برگزاری آزمون آنلاین خوش آمدید.`, {
        parse_mode: 'Markdown',
        reply_markup: getStudentMenuKeyboard(),
      });
    } else {
      await ctx.reply(
        `👋 *به سامانه برگزاری آزمون خوش آمدید*\n\nلطفاً جهت ورود، مشخصات خود را وارد نمایید:`,
        { parse_mode: 'Markdown' }
      );
      await handleStudentLoginPrompt(ctx);
    }
  });

  bot.command('login', async (ctx) => {
    await handleStudentLoginPrompt(ctx);
  });

  bot.command('admin', async (ctx) => {
    if (ctx.state.isAdmin) {
      await ctx.reply(`👑 *پنل کنترل مدیر*`, {
        parse_mode: 'Markdown',
        reply_markup: getAdminMenuKeyboard(),
      });
    } else {
      await ctx.reply('❌ شما دسترسی مدیریت ندارید.');
    }
  });

  // Admin Text Buttons
  bot.hears('👥 تعریف دانش‌آموز', handleCreateStudentStart);
  bot.hears('📝 تعریف آزمون جدید', async (ctx) => {
    if (!ctx.state.isAdmin) return ctx.reply('❌ دسترسی مدیر لازم است.');
    await ctx.conversation.enter('createExamConversation');
  });
  bot.hears('🗑️ حذف آزمون', handleDeleteExamPrompt);
  bot.hears('📊 نتایج همه آزمون‌ها', handleViewAllResultsPrompt);
  bot.hears('👥 لیست دانش‌آموزان', handleListStudents);
  bot.hears('❌ حذف دانش‌آموز', handleDeleteStudentPrompt);

  // Student Text Buttons
  bot.hears('📝 آزمون‌های فعال', handleShowActiveExams);
  bot.hears('📅 آزمون‌های آینده', handleShowUpcomingExams);
  bot.hears('📊 کارنامه و نتایج قبلی', handleShowPreviousResults);
  bot.hears('🏆 رتبه‌بندی', handleShowRankings);
  bot.hears('🚪 خروج از حساب', handleStudentLogout);

  // Exam Toolbar Buttons
  bot.hears('⏳ زمان باقی‌مانده', handleCheckRemainingTime);
  bot.hears('📌 سوالات نشان‌دار', handleShowMarkedQuestions);
  bot.hears('❓ سوالات بدون پاسخ', handleShowUnansweredQuestions);
  bot.hears('📄 دریافت مجدد PDF', handleRedownloadPDF);
  bot.hears('✅ پایان و ثبت آزمون', handleFinishExamPrompt);

  // Callbacks
  bot.callbackQuery(/^(select_exam_|start_exam_)/, handleSelectExam);
  bot.callbackQuery(/^show_sheet:/, handleShowAnswerSheet);
  bot.callbackQuery(/^ans:/, handleAnswerSelection);
  bot.callbackQuery(/^mark:/, handleToggleMark);
  bot.callbackQuery(/^confirm_finish:/, handleConfirmFinish);
  bot.callbackQuery(/^cancel_finish:/, handleCancelFinish);
  bot.callbackQuery(/^delete_exam_/, handleConfirmDeleteExam);
  bot.callbackQuery(/^view_results_/, handleShowAdminExamResults);
  bot.callbackQuery(/^delete_student_/, handleConfirmDeleteStudent);

  // Fallback text handler for login/creation step processing
  bot.on('message:text', async (ctx) => {
    if (await handleProcessStudentCreation(ctx)) return;
    if (await handleProcessStudentLogin(ctx)) return;
  });

  bot.catch((err) => {
    console.error('Error in grammY bot:', err);
  });

  return bot;
}
