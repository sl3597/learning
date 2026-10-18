// Picks the Claude backend (see BACKEND in config.js). Both expose the same chat() / ingestPaper() contract.
import { BACKEND, MODEL, CC_MODEL, credentialSource } from "./config.js";
import * as api from "./agent.js";
import * as paperApi from "./paper.js";
import * as claudeCode from "./claude-code.js";

export const backend =
  BACKEND === "api"
    ? { name: "api", model: MODEL, chat: api.chat, ingestPaper: paperApi.ingestPaper, status: () => ({ ready: Boolean(credentialSource()), credentials: credentialSource() }) }
    : {
        name: "claude-code",
        model: `Claude Code · ${CC_MODEL}`,
        chat: claudeCode.chat,
        ingestPaper: claudeCode.ingestPaper,
        status: () => {
          const s = claudeCode.claudeCodeStatus();
          return { ready: s.installed && s.loggedIn, ...s };
        },
      };
