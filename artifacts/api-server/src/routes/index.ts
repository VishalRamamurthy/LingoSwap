import { Router, type IRouter } from "express";
import healthRouter from "./health";
import translateRouter from "./translate";
import voiceTranslateRouter from "./voice-translate";
import ttsRouter from "./tts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(translateRouter);
router.use(voiceTranslateRouter);
router.use(ttsRouter);

export default router;
