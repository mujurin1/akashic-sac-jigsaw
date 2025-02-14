import { SacServer } from "akashic-sac";
import { JoinPlayer } from "./event/Events";
import { serverTitle } from "./event/TitleEvent";
import { PlayerManager } from "./util/PlayerManager";

export function serverStart(server: SacServer) {
  const { serverDI } = g.game.serverEnv;
  const playerManager = serverDI.get(PlayerManager);

  JoinPlayer.receive(server, data => {
    if (data.playerId == null) return;

    playerManager.upsert(data.playerId, data.name, data.realName);
    server.broadcast(data);
  });

  serverTitle(server);
}
