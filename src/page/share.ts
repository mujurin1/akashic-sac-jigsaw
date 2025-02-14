import { resolvePlayerInfo } from "@akashic-extension/resolve-player-info";
import { SacClient } from "akashic-sac";
import { JoinPlayer } from "../event/Events";
import { PlayerManager } from "../util/PlayerManager";
import { Title } from "./Title/Title";

export function clientStart(client: SacClient) {
  const { clientDI } = client.env;
  const playerManager = clientDI.get(PlayerManager);

  JoinPlayer.receive(client, data => {
    if (data.playerId == null) return;

    playerManager.upsert(data.playerId, data.name, data.realName);
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
