import bcrypt from "bcryptjs";
import { BankStatus, PrismaClient, QuestionType, UserRole } from "@prisma/client";

import { ensureProcessEnvLoaded } from "@/server/load-env";

ensureProcessEnvLoaded();

const prisma = new PrismaClient();

async function main() {
  const defaultPasswordHash = await bcrypt.hash("123456", 10);

  await prisma.user.upsert({
    where: { loginName: "admin" },
    update: {
      displayName: "admin",
      passwordHash: defaultPasswordHash,
      role: UserRole.ADMIN,
    },
    create: {
      loginName: "admin",
      displayName: "admin",
      passwordHash: defaultPasswordHash,
      role: UserRole.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { loginName: "syy" },
    update: {
      displayName: "syy",
      passwordHash: defaultPasswordHash,
      role: UserRole.LEARNER,
    },
    create: {
      loginName: "syy",
      displayName: "syy",
      passwordHash: defaultPasswordHash,
      role: UserRole.LEARNER,
    },
  });

  const bank = await prisma.questionBank.upsert({
    where: { code: "civil-code-basic" },
    update: {
      name: "民法基础练习",
      description: "用于演示题库列表、继续练习和错题本流程。",
      status: BankStatus.ACTIVE,
    },
    create: {
      code: "civil-code-basic",
      name: "民法基础练习",
      description: "用于演示题库列表、继续练习和错题本流程。",
      status: BankStatus.ACTIVE,
    },
  });

  const questions = [
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
      analysis: "民法典明确规定，自然人的民事权利能力始于出生、终于死亡。",
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
  ];

  for (const item of questions) {
    await prisma.question.upsert({
      where: {
        bankId_sortOrder: {
          bankId: bank.id,
          sortOrder: item.sortOrder,
        },
      },
      update: {
        type: item.type,
        stem: item.stem,
        options: item.options,
        correctAnswers: item.correctAnswers,
        analysis: item.analysis,
        lawSource: item.lawSource,
      },
      create: {
        bankId: bank.id,
        type: item.type,
        stem: item.stem,
        options: item.options,
        correctAnswers: item.correctAnswers,
        analysis: item.analysis,
        lawSource: item.lawSource,
        sortOrder: item.sortOrder,
      },
    });
  }

  console.log("Seed complete", { bankId: bank.id });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
