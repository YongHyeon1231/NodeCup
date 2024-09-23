import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';
import au from '../middlewares/auths/user-auth.middleware.js';

const router = express.Router();

// MMR 변화 폭 기준 설정
const mmrrange = 100; // 최성원 추가 (ELO 방식으로 변경)

// 시즌 우승 기준 MMR 설정
const championMMR = 1200; // 최성원 추가 (시즌제 추가)

// 게임플레이 API
router.post('/gameplay', au, async (req, res, next) => {
  const { lineUp } = req.body;

  try {
    // 유저의 포메이션 조회
    const userFormations = await prisma.formations.findMany({
      where: { userId: req.user.userId },
    });

    if (userFormations.length === 0) {
      return res.status(404).json({ message: '포메이션을 찾을 수 없습니다.' });
    }

    // 내가 선택한 라인업의 포메이션 찾기
    const userFormation = userFormations.find((formation) => formation.lineUp === lineUp);

    if (!userFormation) {
      return res.status(404).json({ message: '선택한 라인업의 포메이션을 찾을 수 없습니다.' });
    }

    const userTotalStat = userFormation.teamTotalStat;

    //## 최성원 삭제 (전체 랜덤 → 점수 가까운 순으로 바꾸기 위함)
    // // 상대 유저 랜덤 선택
    // const opponent = await prisma.users.findMany({ where: { NOT: { userId: req.user.userId } } });
    // const randomOpponent = opponent[Math.floor(Math.random() * opponent.length)];

    // // 상대 포메이션 조회
    // const opponentFormations = await prisma.formations.findMany({
    //   where: { userId: randomOpponent.userId },
    // });

    // if (opponentFormations.length === 0) {
    //   return res.status(404).json({ message: '상대 포메이션을 찾을 수 없습니다.' });
    // }
    //## 최성원 삭제 (전체 랜덤 → 점수 가까운 순으로 바꾸기 위함)

    //## 최성원 추가 (전체 랜덤 → 점수 가까운 순으로 바꾸기 위함)
    // 우리 클럽
    const myclub = await prisma.club.findFirst({
      where: { userId: req.user.userId },
    });

    // 상대 클럽 전체
    const opponents = await prisma.club.findMany({
      where: { NOT: { userId: req.user.userId } },
    });

    // 상대 클럽 전체를 우리클럽과 MMR격차가 작은 순서로 정렬
    const MMRopponents = opponents.sort(
      (a, b) => Math.abs(myclub.MMR - a.MMR) - Math.abs(myclub.MMR - b.MMR),
    );

    // 정렬된 순서대로 보유한 Formation이 있는 상대 탐색
    let opponentFormation;
    for (let opponent of MMRopponents) {
      opponentFormation = await prisma.formations.findFirst({
        where: { userId: opponent.userId },
      });
      if (opponentFormation) {
        break;
      }
    }
    //## 최성원 추가 (전체 랜덤 → 점수 가까운 순으로 바꾸기 위함)

    //## 최성원 삭제 (전체 랜덤 → 점수 가까운 순으로 바꾸기 위함)
    // // 랜덤하게 상대 포메이션 선택
    // const opponentFormation =
    //   opponentFormations[Math.floor(Math.random() * opponentFormations.length)];
    //## 최성원 삭제 (전체 랜덤 → 점수 가까운 순으로 바꾸기 위함)

    //## 최성원 추가 (유효성 검사)
    if (!opponentFormation) {
      return res
        .status(404)
        .json({ Message: `게임 내에 포메이션이 준비된 유저가 존재하지 않습니다.` });
    }
    //## 최성원 추가 (유효성 검사)

    const opponentTotalStat = opponentFormation.teamTotalStat;

    // 스탯에 따른 점수 계산
    const statDifference = userTotalStat - opponentTotalStat;
    const baseScore = Math.floor(Math.random() * 3) + 1; // 기본 점수는 1~3
    let userScore = baseScore;
    let opponentScore = baseScore;

    // 스탯 차이로 인한 점수 증가
    if (statDifference > 0) {
      // 스탯 차이가 10 이상 일 때 내 점수 추가
      userScore += Math.floor(statDifference / 10);
    } else {
      // 상대방의 스탯이 높을 경우 상대 점수 증가
      opponentScore += Math.floor(-statDifference / 10);
    }

    // 최종 점수는 최소 1점에서 최대 5점으로 제한
    userScore = Math.min(Math.max(userScore, 1), 5);
    opponentScore = Math.min(Math.max(opponentScore, 1), 5);

    // 동점 방지 (동점일 경우 점수 조정)
    if (userScore === opponentScore) {
      if (Math.random() > 0.5) {
        userScore++; // 내 점수 증가
      } else {
        opponentScore++; // 상대방 점수 증가
      }

      //## 최성원 삭제 (불가능한 상황: 4:3이 최대)
      // // 최종 점수는 여전히 5점을 넘지 않도록 제한
      // userScore = Math.min(userScore, 5);
      // opponentScore = Math.min(opponentScore, 5);
      //## 최성원 삭제 (불가능한 상황: 4:3이 최대)
      // 최종 점수는 여전히 5점을 넘지 않도록 제한
      userScore = Math.min(userScore, 5);
      opponentScore = Math.min(opponentScore, 5);
    }

    let result;
    // let mmrChange = 10; // 기본 MMR 변화량 //////최성원 삭제 (ELO 방식으로 변경)
    const userClub = await prisma.club.findUnique({ where: { userId: req.user.userId } });
    const opponentClub = await prisma.club.findUnique({
      where: { userId: opponentFormation.userId },
    });

    let earnedGold, mmrChangeAmount;

    const mmrdifference = (opponentClub.MMR - userClub.MMR) / 400; //////최성원 추가 (ELO 방식으로 변경)
    const predictedwinrate = 1 / (10 ** mmrdifference + 1); //////최성원 추가 (ELO 방식으로 변경)
    if (userScore > opponentScore) {
      result = `${userClub.clubName}님이 승리하였습니다! 스코어 ${userScore} - ${opponentScore} 로 이겼습니다!`;
      earnedGold = 10000;
      mmrChangeAmount = Math.ceil(mmrrange * (1 - predictedwinrate)); //////최성원 수정 (ELO 방식으로 변경)

      await prisma.club.update({
        where: { userId: req.user.userId },
        data: {
          win: { increment: 1 },
          gold: { increment: earnedGold },
          MMR: { increment: mmrChangeAmount }, //////최성원 수정 (ELO 방식으로 변경)
        },
      });
      await prisma.club.update({
        where: { userId: opponentClub.userId }, //////최성원 수정 (ELO 방식으로 변경)
        data: {
          lose: { increment: 1 },
          gold: { increment: 5000 },
          MMR: { decrement: mmrChangeAmount }, //////최성원 수정 (ELO 방식으로 변경)
        },
      });

      //## 최성원 추가 (시즌제 기능 추가 / MMR 기준)
      if (userClub.MMR + mmrChangeAmount > championMMR) {
        const champions = await prisma.champion.findMany({});
        let prevseason = 0;
        for (let champion of champions) {
          prevseason = Math.max(prevseason, champion.Season);
        }

        await prisma.champion.create({
          data: {
            Season: prevseason + 1,
            clubName: userClub.clubName,
            win: userClub.win + 1,
            lose: userClub.lose,
            winRate: (userClub.win + 1) / (1 + userClub.win + userClub.lose),
            MMR: userClub.MMR + mmrChangeAmount,
          },
        });

        const Resetclubs = await prisma.club.findMany({});
        for (let Resetclub of Resetclubs) {
          await prisma.club.update({
            where: { clubId: Resetclub.clubId },
            data: {
              win: 0,
              lose: 0,
              MMR: 1000,
            },
          });
        }

        result += ` ${userClub.clubName}님이 ${prevseason + 1}시즌 챔피언을 차지하였습니다!`;
      }
      //## 최성원 추가 (시즌제 기능 추가 / MMR 기준)

      result += ` ${earnedGold} 골드를 획득하였습니다! MMR이 ${mmrChangeAmount} 상승하였습니다!`;
    } else {
      result = `${opponentClub.clubName}님이 승리하였습니다! 스코어 ${userScore} - ${opponentScore} 로 이겼습니다!`;
      earnedGold = 5000;
      mmrChangeAmount = Math.ceil(mmrrange * predictedwinrate); //////최성원 수정 (ELO 방식으로 변경)

      await prisma.club.update({
        where: { userId: req.user.userId },
        data: {
          lose: { increment: 1 },
          gold: { increment: earnedGold },
          MMR: { decrement: mmrChangeAmount },
        },
      });
      await prisma.club.update({
        where: { userId: opponentClub.userId }, //////최성원 수정 (ELO 방식으로 변경)
        data: {
          win: { increment: 1 },
          gold: { increment: 10000 },
          MMR: { increment: mmrChangeAmount }, //////최성원 수정 (ELO 방식으로 변경)
        },
      });

      //## 최성원 추가 (시즌제 기능 추가 / MMR 기준)
      if (opponentClub.MMR + mmrChangeAmount > championMMR) {
        const champions = await prisma.champion.findMany({});
        let prevseason = 0;
        for (let champion of champions) {
          prevseason = Math.max(prevseason, champion.Season);
        }

        await prisma.champion.create({
          data: {
            Season: prevseason + 1,
            clubName: opponentClub.clubName,
            win: opponentClub.win + 1,
            lose: opponentClub.lose,
            winRate: (opponentClub.win + 1) / (1 + opponentClub.win + opponentClub.lose),
            MMR: opponentClub.MMR + mmrChangeAmount,
          },
        });

        const Resetclubs = await prisma.club.findMany({});
        for (let Resetclub of Resetclubs) {
          await prisma.club.update({
            where: { clubId: Resetclub.clubId },
            data: {
              win: 0,
              lose: 0,
              MMR: 1000,
            },
          });
        }

        result += ` ${opponentClub.clubName}님이 ${prevseason + 1}시즌 챔피언을 차지하였습니다!`;
      }
      //## 최성원 추가 (시즌제 기능 추가 / MMR 기준)

      result += ` ${earnedGold} 골드를 획득하였습니다. MMR이 ${mmrChangeAmount} 감소하였습니다.`;
    }

    return res.status(200).json({
      message: result,
      opponent: opponentClub.clubName,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
