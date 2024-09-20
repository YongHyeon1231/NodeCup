import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';
import au from '../middlewares/auths/user-auth.middleware.js';

const router = express.Router();

// 포메이션 팀 카드 넣기 validator만들기 생각
router.post('/formations', au, async (req, res, next) => {
  try {
    const {user} = req.user;
    const {cardNumber, lineUp, position} = req.body;
    
    // 클럽 정보 조회 <- 나중에 auths로 바꿔보자
    const userClub = await prisma.club.findFirst({ where: { userId: user.userId } });

    if(!userClub) {
        return res.status(404).json({ message: '클럽이 존재하지 않습니다.' });
    }

    // 슬롯에 해당 카드 찾기
    const inputCard = await prisma.cards.findFirst({
        where: {cardNumber: cardNumber}
    })

    if (!inputCard) {
        return res.status(404).json({message: `해당 슬롯:${cardNumber}에 해당하는 카드가 슬롯에 없습니다.`});
    }

    // 이미 장착된 카드인지 아닌지
    if (inputCard.equipState) {
        return res.status(401).json({message: '이미 장착된 카드 입니다.'});
    }

    // 해당 포메이션 슬롯에 해당 lineUp과 Position에 카드가 있는지 체크
    const preformationCard = await prisma.formations.findFirst({
        where: { lineUp: lineUp, position: position }
    });

    await prisma.$transaction(async (tx) => {
        let msg;
        if(preformationCard) { // 해당 포메이션에 들어가 있다면 카드 슬롯 상태 바꿔주고 formationCard 바꿔주기
            await tx.cards.update({ // equipState false로 바꿔주기
                where: {slotNumber: inputCard.slotNumber},
                data: {
                    equipState: false
                }
            })

            const updateFormationCard = await tx.formations.update({
                data: {
                    card_enhancement: inputCard.card_enhancement,
                    cardName: inputCard.cardName,
                    cardNumber: inputCard.cardNumber,
                    teamTotalStat: {
                        increment: -(preformationCard.speed* 0.1) - (preformationCard.shoot_accuracy*0.25) - (preformationCard.shoot_power*0.15)- (preformationCard.defense*0.3) - (preformationCard.stamina*0.2),
                        increment: +(inputCard.speed* 0.1) + (inputCard.shoot_accuracy*0.25) + (inputCard.shoot_power*0.15)+ (inputCard.defense*0.3) + (inputCard.stamina*0.2)
                    },
                    lineUp: lineUp,
                    position: position
                }
            })
            msg = {message: '포메이션 카드가 바뀌었습니다.', data : updateFormationCard};
        } else { // 해당 포메이션이 비어 있으면 슬롯에 넣어주기
            const createFormationCard = await tx.formations.create({
                data: {
                    userId: user.userId,
                    clubId: userClub.clubId,
                    card_enhancement: inputCard.card_enhancement,
                    cardname: inputCard.cardName,
                    cardNumber: inputCard.cardNumber,
                    teamTotalStat: {
                        increment: +(inputCard.speed* 0.1) + (inputCard.shoot_accuracy*0.25) + (inputCard.shoot_power*0.15)+ (inputCard.defense*0.3) + (inputCard.stamina*0.2)
                    },
                    lineUp: lineUp,
                    position: position
                }
            })
    
            await tx.cards.update({ // 해당 슬롯 equipState true로 바꿔주기
                where: {slotNumber: inputCard.slotNumber},
                data: {
                    equipState: true
                }
            })

            msg = {message: '포메이션이 추가되었습니다.', data: createFormationCard};
        }
    })
    
    return res.status(200).json(msg);
  } catch (error) {
    next(error);
  }
});

// 포메이션 조회 가능
// 질문 -> formations가 여러개인데 lineUp이 2개인데 lineUp으로 구분지어서 조회
router.get('/formations', au, async(req, res, next) => {
    try {
        const { user } = req.user;

        const formationA = await prisma.formations.findMany({
            where: {userId: user.userId, lineUp: "A"},
            select: {
                cardname: true,
                card_enhancement: true,
                cardNumber: true,
                position: true,
                teamTotalStat: true,
            }
        })

        const formationB = await prisma.formations.findMany({
            where: {userId: user.userId, lineUp: "B"},
            select: {
                cardname: true,
                card_enhancement: true,
                cardNumber: true,
                position: true,
                teamTotalStat: true,
            }
        })
        
        const msg = { LineUp_A: formationA, LineUp_B: formationB};
        return res.status(200).json(msg);
    } catch(error) {
        next(error);
    }
})

export default router;
