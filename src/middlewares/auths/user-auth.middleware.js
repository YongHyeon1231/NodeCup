import jwt from "jsonwebtoken";
import {prisma} from "../../lib/utils/prisma/index.js";

export default async (req, res, next) => {
    try {
        const { authorization } = req.headers;
        console.log("authorization => ", authorization);
        if (!authorization) throw new Error("토큰이 존재하지 않습니다.");

        const [tokenType, token] = authorization.split(" ");

        if (tokenType !== "Bearer") throw new Error("토큰 타입이 Bearer가 아닙니다.");

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);
        const email = decodedToken.email;

        const user = await prisma.Users.findFirst({
            where: {email: email},
        });

        if (!user) throw new Error("토큰 사용자가 존재하지 않습니다.");

        req.user = user;
        console.log("user => ", user);

        next();
    } catch(error) {
        res.clearHeaders("authorization");

        switch(error.name) {
            case "TokenExpiredError":
                return res.status(401).json({message: "토큰이 만료되었습니다."});
            case "JsonWebTokenerror":
                return res.status(401).json({message: "토큰이 조작되었습니다."});
            default:
                return res.status(401).json({message: error.message ?? "비정상적인 요청입니다."});
        }
    }
}