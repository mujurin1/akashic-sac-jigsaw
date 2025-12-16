import { Label } from "@akashic-extension/akashic-label";
import { createFont } from "akashic-sac";
import { toggleVisibleTo } from "../../../common/func";
import { PlayerManager } from "../../../util/PlayerManager";
import { ClientPlaying } from "./ClientPlaying";

export interface RankingGroup {
  readonly panel: g.E;

  /**
   * 表示を切り替える
   * @param visibleTo `true`: 表示, `false`: 非表示, `undefined`: トグル
   */
  toggle(visibleTo?: boolean): void;

  disable(): void;
}

export function createRankingGroup(clientPlaying: ClientPlaying): RankingGroup {
  const { display, client } = clientPlaying;

  const rank_icons = [
    client.env.scene.asset.getImageById("crown_1"),
    client.env.scene.asset.getImageById("crown_2"),
    client.env.scene.asset.getImageById("crown_3"),
  ] as const;

  const playerManager = client.env.clientDI.get(PlayerManager);
  const playerEntities = new Map<string, PlayerEntity>();

  const { panel, nameArea } = createRankingPanel(
    display,
    () => playerManager.players.length
  );

  const onPlayerUpdatedKey = playerManager.onUpdated.on(update);

  let updateSkipped = true;

  return {
    panel,
    toggle: value => {
      toggleVisibleTo(panel, value);
      if (panel.visible() && updateSkipped) {
        update();
        updateSkipped = false;
      }
    },
    disable,
  };

  function update(): void {
    if (!panel.visible()) {
      updateSkipped = true;
      return;
    }

    for (let i = 0; i < playerManager.players.length; i++) {
      const player = playerManager.players[i];
      const entity = getPlayerEntity(player.id);

      if (player.rank <= 3) {
        entity.crownIcon.show();

        const iconSrc = rank_icons[player.rank - 1];
        if (entity.crownIcon.src !== iconSrc) {
          entity.crownIcon.src = iconSrc;
          entity.crownIcon.invalidate();
        }
      } else {
        entity.crownIcon.hide();
      }

      if (entity.rankLabel.text !== `${player.rank}位`) {
        entity.rankLabel.text = `${player.rank}位`;
        entity.rankLabel.invalidate();
      }

      const nameLabel = entity.nameLabel;

      if (nameLabel.text !== player.name) {
        const textWidth = font.measureText(player.name).width;
        if (textWidth > nameLabel.width) {
          nameLabel.y = 8;
          nameLabel.fontSize = 28;
        } else {
          nameLabel.y = 0;
          nameLabel.fontSize = font.size;
        }

        nameLabel.text = player.name;
        nameLabel.invalidate();
      }

      if (entity.scoreLabel.text !== `${player.score}`) {
        entity.scoreLabel.text = `${player.score}`;
        entity.scoreLabel.invalidate();
      }
      if (entity.display.y !== i * C.PlayerEntityHeight) {
        entity.display.y = i * C.PlayerEntityHeight;
        entity.display.modified();
      }
    }
  }

  function disable(): void {
    playerManager.onUpdated.off(onPlayerUpdatedKey);
  }

  function getPlayerEntity(id: string): PlayerEntity {
    let entity = playerEntities.get(id);
    if (entity) return entity;

    entity = createPlayerEntity(nameArea);
    playerEntities.set(id, entity);
    return entity;
  }
}



const enum C {
  PlayerEntityHeight = 56,
}


interface PlayerEntity {
  readonly display: g.E;
  readonly crownIcon: g.Sprite;
  readonly rankLabel: g.Label;
  readonly nameLabel: Label;
  readonly scoreLabel: g.Label;
}

function createRankingPanel(
  parent: g.E,
  playerCount: () => number
): {
  panel: g.E;
  nameArea: g.E;
} {
  const scene = parent.scene;
  const src = scene.asset.getImageById("ranking_view");

  const panel = new g.Sprite({
    scene, parent,
    hidden: true,
    src,
    x: (950 - src.width) / 2, y: (g.game.height - src.height) / 2,
  });

  const marginW = 100;

  const namePane = new g.Pane({
    scene, parent: panel,
    x: marginW / 2, y: 175,
    // スコアがはみ出しても良いように右側を広くする
    width: panel.width - marginW / 2, height: 480,
    touchable: true,
  });
  const nameArea = new g.E({ scene, parent: namePane });

  namePane.onPointMove.add(e => {
    const maxY = playerCount() * C.PlayerEntityHeight;
    const newY = nameArea.y + e.prevDelta.y;
    nameArea.y = Math.min(0, Math.max(namePane.height - maxY, newY));
    nameArea.modified();
  });

  return { panel, nameArea };
}

const font = createFont({ size: 40 });

function createPlayerEntity(parent: g.E): PlayerEntity {
  const scene = parent.scene;
  const display = new g.E({ scene, parent });

  const iconSrc = scene.asset.getImageById("crown_1");

  return {
    display,

    crownIcon: new g.Sprite({
      scene, parent: display,
      src: iconSrc,
      x: 5,
      y: 5,
      hidden: true,
    }),
    rankLabel: new g.Label({
      scene, parent: display,
      text: "1位",
      x: 70,
      width: 110,
      widthAutoAdjust: false,
      textAlign: "right",
      font,
    }),
    nameLabel: new Label({
      scene, parent: display,
      x: 200,
      width: 480,
      text: "なまえ",
      font,
    }),
    scoreLabel: new g.Label({
      scene, parent: display,
      text: "1000",
      font,
      x: 700,
    }),
  };
}
