import { prisma } from '../lib/utils/prisma/index.js';

class FormationRepository {
  async findFormation(userId, clubId, lineUp, position) {
    return await prisma.formations.findFirst({
      where: {
        lineUp,
        position,
        userId,
        clubId,
      },
    });
  }

  async findAnyFormation(userId, clubId, lineUp) {
    return await prisma.formations.findFirst({
      where: {
        userId,
        clubId,
        lineUp,
      },
    });
  }

  async findManyFormation(userId) {
    return await prisma.formations.findMany({
      where: { userId: userId },
      select: {
        cardName: true,
        cardEnhancement: true,
        cardNumber: true,
        position: true,
        teamTotalStat: true,
        lineUp: true,
      },
    });
  }

  async createFormation(data) {
    return await prisma.formations.create(data);
  }

  async updateFormation(formationId, data, userId, clubId) {
    return await prisma.formations.update({
      where: {
        formationId,
        userId,
        clubId,
      },
      data,
    });
  }

  async updateTeamTotalStat(lineUp, userId, clubId, teamTotalStat) {
    return await prisma.formations.updateMany({
      whgere: {
        userId,
        clubId,
        lineUp,
      },
      data: { teamTotalStat: teamTotalStat },
    });
  }

  async deleteFormation(formationId, userId, clubId) {
    return await prisma.formations.delete({
      where: {
        formationId,
        userId,
        clubId,
      },
    });
  }
}

export default new FormationRepository();
