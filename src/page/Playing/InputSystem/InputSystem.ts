import { BACKGROUND_COLOR } from "../PlayingClientConst";
import { ClientPlaying } from "../State/ClientPlaying";
import { MobileInputSystem } from "./MobileInputSystem";
import { PcInputSystem } from "./PcInputSystem";

/** 入力方式の種類 */
export const InputSystemType = ["pc", "mobile"] as const;
export type InputSystemType = typeof InputSystemType[number];

export interface InputSystemControl {
  readonly inputUiParent: g.E;
  readonly currentType: InputSystemType;
  readonly current: InputSystem;

  toggleInputSystem(type?: InputSystemType): void;
  destroy(): void;
}

/**
 * デバイス毎の操作方法の管理を行う
 */
export function inputSystemControl(clientPlaying: ClientPlaying): InputSystemControl {
  let currentType: InputSystemType = "pc";

  const inputUiParent = new g.E({ scene: g.game.env.scene });
  const inputSystems = {
    "pc": PcInputSystem(clientPlaying, inputUiParent),
    "mobile": MobileInputSystem(clientPlaying, inputUiParent),
  } as const satisfies Record<InputSystemType, InputSystem>;

  const control: InputSystemControl = {
    inputUiParent,
    get currentType() { return currentType; },
    get current() { return inputSystems[currentType]; },

    toggleInputSystem,
    destroy,
  };
  inputSystems.pc.enable(createNewUiState());

  return control;

  function toggleInputSystem(type?: InputSystemType) {
    if (type == null) type = currentType === "mobile" ? "pc" : "mobile";
    if (type === currentType) return;
    clientPlaying.playState.release();
    inputSystems[currentType].disable();

    currentType = type;
    inputSystems[type].enable(createNewUiState());
  }
  function destroy() {
    for (const type of InputSystemType) {
      inputSystems[type].destroy();
    }
  }

  // TODO: これの関数名ビミョすぎ
  function createNewUiState(): NewUiState {
    return {
      nextBgColor: BACKGROUND_COLOR.nextIconBg[clientPlaying.uiGroups.bg.color.cssColor],
    };
  }
}

interface NewUiState {
  readonly nextBgColor: string;
}


export interface InputSystem {
  /**
   * このモードが無効になったことを伝える
   */
  disable(): void;
  /**
   * このモードが有効になったことを伝える
   * @param newUiState 新しいUIの状態
   */
  enable(newUiState: NewUiState): void;
  /**
   * 今持っているピースを強制的に放す
   */
  forceRelease(): void;

  destroy(): void;
}
