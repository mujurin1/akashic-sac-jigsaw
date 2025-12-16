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

    // MEMO: テスト用ダミープレイヤー追加
    playerManager.upsert(data.pId + " 1", data.name + " 1", data.realName);
    playerManager.upsert(data.pId + " 2", data.name + " 2", data.realName);
    playerManager.upsert(data.pId + " 3", data.name + " 3", data.realName);
    playerManager.upsert(data.pId + " 4", data.name + " 4", data.realName);
    playerManager.upsert(data.pId + " 5", data.name + " 5", data.realName);
    playerManager.upsert(data.pId + " 6", data.name + " 6", data.realName);
    playerManager.upsert(data.pId + " 7", data.name + " 7", data.realName);
    playerManager.upsert(data.pId + " 8", data.name + " 8", data.realName);
    playerManager.upsert(data.pId + " 9", data.name + " 9", data.realName);
    playerManager.upsert(data.pId + " 10", data.name + " 10", data.realName);
    playerManager.upsert(data.pId + " 11", data.name + " 11", data.realName);
    playerManager.upsert(data.pId + " 12", data.name + " 12", data.realName);
    playerManager.upsert(data.pId + " 13", data.name + " 13", data.realName);
    playerManager.upsert(data.pId + " 14", data.name + " 14", data.realName);
    playerManager.upsert(data.pId + " 15", data.name + " 15", data.realName);
    playerManager.upsert(data.pId + " 16", data.name + " 16", data.realName);
    playerManager.upsert(data.pId + " 17", data.name + " 17", data.realName);

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
