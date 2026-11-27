import { Router } from "express";
import {
  chatController,
  streamChatController
} from "../controllers/chat.controller.js";

const router = Router();

router.post("/stream", streamChatController);
router.post("/", chatController);

export default router;
