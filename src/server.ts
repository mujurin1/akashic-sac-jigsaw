import { Server } from "akashic-sac";
import { JoinPlayer } from "./event/Events";
import { serverTitle } from "./event/TitleEvent";
import { PlayerManager } from "./util/PlayerManager";

export function serverStart(server: Server) {
  const { serverDI } = g.game.serverEnv;
  const playerManager = serverDI.get(PlayerManager);

  JoinPlayer.receive(server, (data) => {
    if (data.playerId == null) return;

    playerManager.upsert(data.playerId, data.name, data.realName);
    server.broadcast(data);
  });

  if (true) {
    const data = {
      eventName: JoinPlayer.name,
      name: "pid1", playerId: "pid1", realName: true,
    } satisfies JoinPlayer;
    playerManager.upsert(data.playerId, data.name, data.realName);
    server.broadcast(data);
  }

  serverTitle(server);
}

// export function serverStart_(server: Server) {
//   const { serverDI } = g.game.serverEnv;
//   const playerManager = serverDI.get(PlayerManager);

//   JoinPlayer.receive(server, data => {
//     if (data.playerId == null) return;
//     if (playerManager.hasRealName(data.playerId)) return;

//     playerManager.upsert(data.playerId, data.name, data.realName);
//     server.broadcast(data);
//   });


//   ShareBigText.resendBroadcast(server, "IMAGE");

//   TextMessage.receive(server, data => {
//     console.log(`playerId: ${data.playerId}`);
//     server.broadcast(new ChangeColor(randomColor()));
//   });
// }

// function randomColor(): string {
//   return `rgb(${randomInt(256)},${randomInt(256)},${randomInt(256)})`;
// }

// function randomInt(max: number): number {
//   return Math.floor(Math.random() * max);
// }
