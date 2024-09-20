import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';
import au from '../middlewares/auths/user-auth.middleware.js';

const router = express.Router();

// 카드 생성 API

router.post('/cardModel', au, async (req, res, next) => {
    try{
        // 현재 사용자가 운영자인지 확인
        if(!req.user.isGM) {
            return res.status(400).json({ message : "카드를 생성할 권한이 없습니다."})
        }

        let cardData = req.body

        if (!Array.isArray(cardData)){
            cardData = [cardData];
        }

        // 중복 검사 : cardName ~ stamina 값이 모두 같은 카드는 생성 불가능!
        for(const card of cardData){
            const existingCard = await prisma.cardModel.findFirst({
                where : {
                    cardName : card.cardName,
                    speed : card.speed,
                    shoot_accuracy : card.shoot_accuracy,
                    shoot_power : card.shoot_power,
                    defense : card.defense,
                    stamina : card.stamina
                }
            })

            if(existingCard){
                return res.status(400).json({ message : `${existingCard.cardName} 선수는 이미 존재하는 카드입니다.`})
            }
        }

        await prisma.cardModel.createMany({
            data: cardData,
        })

        // 메시지를 배열형태로 변환하여 출력
        const playerMessages = [];
        const managerMessages = [];

        // cardData의 인자마다 타입을 비교하여 선수와 감독 메시지 출력을 구분
        for (const card of cardData){
            if (card.type === 'player') {
                playerMessages.push(`${card.cardName} 선수가 생성되었습니다.`)
            } else if(card.type === 'manager'){
                managerMessages.push(`${card.cardName} 감독이 생성되었습니다.`)
            }
        }

        // 선수 메시지와 감독 메시지를 최종적으로 스프레드 문법을 이용하여 하나의 배열로 통합
        const allMessages = [...playerMessages, ...managerMessages];

        res.status(200).json({ message : allMessages })
    }
    catch(error){
        next(error);
    }
})

// 카드 수정 API

router.put('/cardModel/:cardCode', au, async (req, res, next) => {
    try {
        //  현재 사용자가 운영자인지 확인
         if(!req.user.isGM) {
            return res.status(400).json({ message : "카드를 수정할 권한이 없습니다."})
        }

        const { cardCode } = req.params;
        const { cardName, speed, shoot_accuracy, shoot_power, defense, stamina, type} = req.body;
        
        console.log('Searching for card with cardCode:', +cardCode);
        
        const card = await prisma.cardModel.findFirst({
            where: {
                cardCode: +cardCode,
            },
        });

        // 카드가 존재하지 않는다면
        if (!card) {
            return res.status(400).json({ error: "존재하지 않는 선수입니다." });
        }

        await prisma.cardModel.update({
            where: {
                cardCode: +cardCode,
            },
            data: {
                cardName,
                speed,
                shoot_accuracy,
                shoot_power,
                defense,
                stamina,
                type
            },
        });

        return res.status(200).json({ message: "수정이 완료되었습니다." });
        
    } catch (error) {
        next(error);
    }
});

export default router;