import verifyToken from "./verifyToken";


const verifyTokenAndAuthorization = (req, res, next) => {
    verifyToken(req, res, () => {
        if(req.user.id === req.params.id || req.user.isAdmin) {
            next(); // Call next callback here
        } else {
            res.status(403).json({ error: "You are not authorized to this request..." });
        }
    });
};


export default verifyTokenAndAuthorization;