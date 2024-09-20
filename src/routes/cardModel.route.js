import express from 'express';
import { prisma } from '../lib/utils/prisma/index.js';

const router = express.Router();

// 카드 생성 API

router.post('/cardmodel', async (req, res, next) => {
    try{
        let cardData = req.body

        if (!Array.isArray(cardData)){
            cardData = [cardData];
        }

        // 중복 검사
        for(const card of cardData){
            const existingCard = await prisma.cardModel.findFirst({
                where : {
                    cardName : card.cardName,
                    speed : card.speed,
                    shoot_accuracy : card.shoot_accuracy,
                    shoot_power : card.shoot_power,
                    defense : card.defense,
                    stamina : card.stamina,
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
        const message = cardData.map(card => `${card.cardName} 선수가 생성되었습니다.`)

        res.status(200).json({ message })
    }
    catch(error){
        next(error);
    }
})

export default router;