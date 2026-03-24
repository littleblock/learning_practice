import bcrypt from "bcryptjs";
import {
  BankStatus,
  PrismaClient,
  QuestionType,
  UserRole,
} from "@prisma/client";

import { ensureProcessEnvLoaded } from "@/server/load-env";

ensureProcessEnvLoaded();

const prisma = new PrismaClient();

async function upsertUser(input: {
  loginName: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
}) {
  await prisma.user.upsert({
    where: { loginName: input.loginName },
    update: {
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      role: input.role,
    },
    create: input,
  });
}

async function upsertBankWithQuestions(input: {
  code: string;
  name: string;
  description: string;
  questions: Array<{
    type: QuestionType;
    stem: string;
    options: Array<{ label: string; text: string }>;
    correctAnswers: string[];
    analysis: string;
    lawSource: string;
    sortOrder: number;
  }>;
}) {
  const bank = await prisma.questionBank.upsert({
    where: { code: input.code },
    update: {
      name: input.name,
      description: input.description,
      status: BankStatus.ACTIVE,
    },
    create: {
      code: input.code,
      name: input.name,
      description: input.description,
      status: BankStatus.ACTIVE,
    },
  });

  for (const question of input.questions) {
    await prisma.question.upsert({
      where: {
        bankId_sortOrder: {
          bankId: bank.id,
          sortOrder: question.sortOrder,
        },
      },
      update: {
        type: question.type,
        stem: question.stem,
        options: question.options,
        correctAnswers: question.correctAnswers,
        analysis: question.analysis,
        lawSource: question.lawSource,
      },
      create: {
        bankId: bank.id,
        type: question.type,
        stem: question.stem,
        options: question.options,
        correctAnswers: question.correctAnswers,
        analysis: question.analysis,
        lawSource: question.lawSource,
        sortOrder: question.sortOrder,
      },
    });
  }

  return bank;
}

async function main() {
  const commonPasswordHash = await bcrypt.hash("123456", 10);

  await upsertUser({
    loginName: "admin",
    displayName: "admin",
    passwordHash: commonPasswordHash,
    role: UserRole.ADMIN,
  });

  for (const learner of [
    { loginName: "syy", displayName: "syy" },
    { loginName: "test01", displayName: "test01" },
    { loginName: "test02", displayName: "test02" },
  ]) {
    await upsertUser({
      ...learner,
      passwordHash: commonPasswordHash,
      role: UserRole.LEARNER,
    });
  }

  const demoBank = await upsertBankWithQuestions({
    code: "civil-code-basic",
    name: "民法基础练习",
    description: "用于演示题库列表、继续练习和错题本流程。",
    questions: [
      {
        type: QuestionType.SINGLE,
        stem: "根据《中华人民共和国民法典》，自然人的民事权利能力始于何时？",
        options: [
          { label: "A", text: "出生时" },
          { label: "B", text: "成年时" },
          { label: "C", text: "登记时" },
          { label: "D", text: "结婚时" },
        ],
        correctAnswers: ["A"],
        analysis: "民法典明确规定，自然人的民事权利能力始于出生，终于死亡。",
        lawSource: "《中华人民共和国民法典》第一编第一章",
        sortOrder: 1,
      },
      {
        type: QuestionType.MULTIPLE,
        stem: "下列哪些属于民事主体依法享有的民事权利？",
        options: [
          { label: "A", text: "物权" },
          { label: "B", text: "债权" },
          { label: "C", text: "知识产权" },
          { label: "D", text: "行政处罚权" },
        ],
        correctAnswers: ["A", "B", "C"],
        analysis: "物权、债权、知识产权均属于民事权利，行政处罚权属于公权力。",
        lawSource: "《中华人民共和国民法典》第一编第二章",
        sortOrder: 2,
      },
      {
        type: QuestionType.JUDGE,
        stem: "判断题：民事主体从事民事活动，应当遵循自愿原则。",
        options: [
          { label: "T", text: "正确" },
          { label: "F", text: "错误" },
        ],
        correctAnswers: ["T"],
        analysis: "自愿原则是民法的基本原则之一。",
        lawSource: "《中华人民共和国民法典》总则编",
        sortOrder: 3,
      },
    ],
  });

  const frontendTestBank = await upsertBankWithQuestions({
    code: "frontend-shared-test-bank",
    name: "前端联调测试题库",
    description: "专供前端联调与自动化回归使用，不影响导入题库和正常学习账号。",
    questions: [
      {
        type: QuestionType.SINGLE,
        stem: "测试题 1：组件样式调整后，哪种做法最容易保证按钮层级清晰？",
        options: [
          { label: "A", text: "主操作使用更醒目的视觉权重" },
          { label: "B", text: "所有按钮都使用同一个主色" },
          { label: "C", text: "把按钮全部放在页面顶部" },
          { label: "D", text: "隐藏次要操作" },
        ],
        correctAnswers: ["A"],
        analysis:
          "主次操作应通过尺寸、颜色和位置形成明确层级，而不是把所有按钮做成同一优先级。",
        lawSource: "前端联调规范",
        sortOrder: 1,
      },
      {
        type: QuestionType.MULTIPLE,
        stem: "测试题 2：为了验证不同学习账号共用同一题库时进度互不影响，应重点观察哪些数据？",
        options: [
          { label: "A", text: "继续练习入口是否指向各自会话" },
          { label: "B", text: "已做题数是否独立变化" },
          { label: "C", text: "错题数是否独立变化" },
          { label: "D", text: "两个账号的密码是否相同" },
        ],
        correctAnswers: ["A", "B", "C"],
        analysis:
          "账号隔离应体现在会话恢复、已做题数和错题统计等用户维度数据上。",
        lawSource: "前端联调规范",
        sortOrder: 2,
      },
      {
        type: QuestionType.JUDGE,
        stem: "测试题 3：同一会话中返回上一题并修改答案时，应该只保留最终答案结果。",
        options: [
          { label: "T", text: "正确" },
          { label: "F", text: "错误" },
        ],
        correctAnswers: ["T"],
        analysis: "本次改造要求上一题支持改答，并且统计只按照最终答案结算。",
        lawSource: "前端联调规范",
        sortOrder: 3,
      },
      {
        type: QuestionType.SINGLE,
        stem: "测试题 4：如果导题解析成功但管理员决定不导入，期望的系统行为是什么？",
        options: [
          { label: "A", text: "批次可正常终止并作废草稿" },
          { label: "B", text: "批次一直保留在处理中" },
          { label: "C", text: "直接把草稿导入正式题库" },
          { label: "D", text: "删除整个题库" },
        ],
        correctAnswers: ["A"],
        analysis:
          "导题任务需要支持终止闭环，尤其是 READY 阶段也应允许作废批次。",
        lawSource: "前端联调规范",
        sortOrder: 4,
      },
    ],
  });

  console.log("Seed complete", {
    demoBankId: demoBank.id,
    frontendTestBankId: frontendTestBank.id,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
