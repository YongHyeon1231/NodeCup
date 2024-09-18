import { PrismaClient } from "@prisma/client";
// 외부에서 prisma를 가져다 쓰기만 하더라도 우리는 실제로 prisma에 적용되어 있는
// 모델 정보들이나 테이블 정보들을 바탕으로 실제 데이터베이스와 통신을 할 수 있게 됩니다.
export const prisma = new PrismaClient({
    log: ["query", "info", "warn", "error"],
    errorFormat: "pretty",
});