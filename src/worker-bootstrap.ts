import { startWorkerRpcHost } from "@paperclipai/plugin-sdk";
import plugin from "./worker.js";

startWorkerRpcHost({ plugin });
