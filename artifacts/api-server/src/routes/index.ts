import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import translateRouter from "./translate";
import voiceTranslateRouter from "./voice-translate";
import transcribeRouter from "./transcribe";
import ttsRouter from "./tts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);        // auth routes — no login required
router.use(translateRouter);
router.use(voiceTranslateRouter);
router.use(transcribeRouter);
router.use(ttsRouter);

export default router;
