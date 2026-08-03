import { config } from './src/config/env.js';
import { connectDB } from './src/config/db.js';
import { createTelegramBot } from './src/bot/index.js';
import { Admin } from './src/models/Admin.js';
import { Student } from './src/models/Student.js';
import { Exam } from './src/models/Exam.js';

async function bootstrap() {
  console.log('Starting Telegram Exam System Bot...');

  // 1. Database Connection
  await connectDB();

  // 2. Seed Default Demo Data if database is clean
  await seedInitialData();

  // 3. Start Telegram Bot Engine with proxy fallback
  const PROXY_TIMEOUT = 5000; // 5 seconds to wait for proxy to connect

  // First attempt: try with proxy
  if (config.proxyUrl) {
    console.log('[BOOT] Attempt 1: Starting bot with proxy...');
    const botWithProxy = createTelegramBot(config.botToken, true);
    if (botWithProxy) {
      let proxyConnected = false;
      
      // Start with proxy
      botWithProxy.start({
        onStart: (info) => {
          proxyConnected = true;
          console.log(`Telegram Bot @${info.username} is LIVE and listening via long polling!`);
        },
      });

      // Wait a bit to see if proxy works
      await new Promise((resolve) => setTimeout(resolve, PROXY_TIMEOUT));
      
      if (!proxyConnected) {
        console.log('[BOOT] Proxy connection timed out. Stopping proxy bot and falling back to direct connection...');
        await botWithProxy.stop();
        
        // Fallback: try without proxy
        console.log('[BOOT] Attempt 2: Starting bot without proxy (direct connection)...');
        const botDirect = createTelegramBot(config.botToken, false);
        if (botDirect) {
          botDirect.start({
            onStart: (info) => {
              console.log(`Telegram Bot @${info.username} is LIVE and listening via long polling!`);
            },
          });
        }
      }
      // If proxyConnected is true, the bot is already running — do nothing more
    }
  } else {
    // No proxy configured at all, start directly
    const bot = createTelegramBot(config.botToken, false);
    if (bot) {
      bot.start({
        onStart: (info) => {
          console.log(`Telegram Bot @${info.username} is LIVE and listening via long polling!`);
        },
      });
    }
  }
}

async function seedInitialData() {
  try {
    // Seed Admins
    for (const adminId of config.adminTelegramIds) {
      let admin = await Admin.findOne({ telegramId: adminId });
      if (!admin) {
        admin = new Admin({
          telegramId: adminId,
          username: 'admin',
          fullName: 'System Administrator',
        });
        await admin.save();
        console.log(`👑 Admin created with ID: ${adminId}`);
      }
    }

    // Seed Demo Student "Ali Ahmadi"
    let ali = await Student.findOne({ username: 'ali' });
    if (!ali) {
      ali = new Student({
        fullName: 'Ali Ahmadi',
        username: 'ali',
        password: '123',
        telegramId: null,
        isLinked: false,
      });
      await ali.save();
      console.log('👤 Demo student "ali" created (password: 123).');
    }

    // Seed Demo Student "Reza"
    let reza = await Student.findOne({ username: 'reza' });
    if (!reza) {
      reza = new Student({
        fullName: 'Reza Mohammadi',
        username: 'reza',
        password: '123',
        telegramId: null,
        isLinked: false,
      });
      await reza.save();
      console.log('👤 Demo student "reza" created (password: 123).');
    }

    // Seed Sample Active Exam if no exams exist
    const examCount = await Exam.countDocuments();
    if (examCount === 0) {
      const now = new Date();
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const demoExam = new Exam({
        title: 'Mathematics Final Examination 1404',
        pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        pdfFileName: 'Math_Final_Exam_1404.pdf',
        questionCount: 5,
        durationMinutes: 90,
        allowedStartDate: new Date(now.getTime() - 1000 * 60 * 60), // Started 1 hour ago
        allowedEndDate: nextWeek,
        allowedStudentIds: [ali._id, reza._id],
        answerKey: [1, 2, 4, 3, 2],
        isImmutable: true,
        createdBy: config.adminTelegramId,
      });

      await demoExam.save();
      console.log('📝 Sample active exam "Mathematics Final Examination 1404" created.');
    }
  } catch (error) {
    console.error('Error seeding initial data:', error);
  }
}

bootstrap().catch((err) => {
  console.error('[FATAL] Fatal Bootstrap Failure:', err);
  process.exit(1);
});