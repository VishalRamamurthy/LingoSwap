import { Router, type IRouter } from "express";
import healthRouter from "./health";
import translateRouter from "./translate";
import voiceTranslateRouter from "./voice-translate";

const router: IRouter = Router();

router.use(healthRouter);
router.use(translateRouter);
router.use(voiceTranslateRouter);

export default router;
