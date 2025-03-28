import { resolvePlayerInfo } from "@akashic-extension/resolve-player-info";
import { SacClient, SacServer } from "akashic-sac";
import { JoinPlayer } from "./event/Events";
import { serverTitle } from "./event/TitleEvent";
import { Title } from "./page/Title/Title";
import { PlayerManager } from "./util/PlayerManager";

export function serverStart(server: SacServer) {
  const { serverDI } = g.game.serverEnv;
  const playerManager = serverDI.get(PlayerManager);

  JoinPlayer.receive(server, data => {
    if (data.pId == null) return;

    playerManager.upsert(data.pId, data.name, data.realName);
    server.broadcast(data);
  });

  serverTitle(server);
}


export function clientStart(client: SacClient) {
  const { clientDI } = client.env;
  const playerManager = clientDI.get(PlayerManager);

  JoinPlayer.receive(client, data => {
    if (data.pId == null) return;

    playerManager.upsert(data.pId, data.name, data.realName);
  });

  Title(client);
}

export function sendJoin() {
  const client = g.game.clientEnv.client;
  if (g.game.isSkipping) return;

  resolvePlayerInfo({ limitSeconds: 20 }, (err, info) => {
    client.sendEvent(
      new JoinPlayer(info?.name ?? "NULL", info?.userData?.accepted ?? false),
    );
  });
}
