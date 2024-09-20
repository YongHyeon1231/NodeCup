import Joi from "joi";

const equipSchema = Joi.object({
    cardNumber: Joi.number().integer().required(),
    lineUp: Joi.string().valid("A", "B").required(),
    position: Joi.string().valid("forward", "midfielder", "defender", "manager").required(),
}).unknown(true);

const unequipSchema = Joi.object({
    cardNumber: Joi.number().integer().required(),
    lineUp: Joi.string().valid("A", "B").required(),
    position: Joi.string().valid("forward", "midfielder", "defender", "manager").required(),
}).unknown(true);

const formationsValidationJoi = {
    equipCodeBodyValidation: async (req, res, next) => {
        const validation = await equipSchema.validateAsync(req.body);

        if (validation.error) {
            return res.status(400).json({message: "equipCodeBodyValidation가 발생하였습니다."});
        }

        next();
    },
    unequipCodeBodyValidation: async (req, res, next) => {
        const validation = await equipSchema.validateAsync(req.body);

        if (validation.error) {
            return res.status(400).json({message: "unequipCodeBodyValidation 발생하였습니다."});
        }

        next();
    },
}

export default formationsValidationJoi;