import { prisma } from '../lib/utils/prisma/index.js';

class CardRepository {
  async findCardByCardNumber(cardNumber, userId, clubId) {
    return await prisma.card.findFirst({
      where: { cardNumber, userId, clubId },
    });
  }

  async updateCardState(cardNumber, userId, clubId, cardId, state) {
    return await prisma.card.update({
      where: {
        cardNumber,
        cardId,
        userId,
        clubId,
      },
      data: { state },
    });
  }

  async findUserClub(userId) {
    return await prisma.club.findFirst({
      where: { userId },
    });
  }
}

export default new CardRepository();
