import { Server, ShareBigText } from "akashic-sac";
import { ChangeColor, TextMessage } from "./Events";
import { JoinPlayer, PlayerManager } from "./event/Player";
import { serverTitle } from "./event/TitleEvent";

export function serverStart(server: Server) {
  const { serverDI } = g.game.serverEnv;
  const playerManager = serverDI.get(PlayerManager);

  JoinPlayer.receive(server, (data) => {
    if (data.playerId == null) return;

    playerManager.upsert(data.playerId, data.name, data.realName);
    server.broadcast(data);
  });

  serverTitle(server);
}

export function serverStart_(server: Server) {
  const { serverDI } = g.game.serverEnv;
  const playerManager = serverDI.get(PlayerManager);

  JoinPlayer.receive(server, data => {
    if (data.playerId == null) return;
    if (playerManager.hasRealName(data.playerId)) return;

    playerManager.upsert(data.playerId, data.name, data.realName);
    server.broadcast(data);
  });


  ShareBigText.resendBroadcast(server, "IMAGE");

  TextMessage.receive(server, data => {
    console.log(`playerId: ${data.playerId}`);
    server.broadcast(new ChangeColor(randomColor()));
  });
}

function randomColor(): string {
  return `rgb(${randomInt(256)},${randomInt(256)},${randomInt(256)})`;
}

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}
