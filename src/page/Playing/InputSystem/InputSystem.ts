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

  /**
   * 操作方法を切り替える
   * @param type 切り替えるタイプ (指定しない場合は次のタイプに切り替える)
   * - `"pc"`: PC向け操作方法
   * - `"mobile"`: モバイル向け操作方法
   */
  toggleInputSystem(type?: InputSystemType): void;

  /**
   * 入力の有効/無効を切り替える
   * @param enabled `true`: 有効, `false`: 無効
   */
  setInputEnabled(enabled: boolean): void;

  destroy(): void;
}

/**
 * デバイス毎の操作方法の管理を行う
 */
export function inputSystemControl(clientPlaying: ClientPlaying): InputSystemControl {
  let currentType: InputSystemType = "pc";
  const scene = g.game.env.scene;

  const control: InputSystemControl = {
    inputUiParent: new g.E({ scene, parent: scene }),
    get currentType() { return currentType; },
    get current() { return inputSystems[currentType]; },

    toggleInputSystem,
    setInputEnabled,
    destroy,
  };

  const inputSystems = {
    "pc": PcInputSystem(clientPlaying, control.inputUiParent),
    "mobile": MobileInputSystem(clientPlaying, control.inputUiParent),
  } as const satisfies Record<InputSystemType, InputSystem>;

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
  function setInputEnabled(enabled: boolean) {
    if (enabled) {
      inputSystems[currentType].enable(createNewUiState());
    } else {
      inputSystems[currentType].disable();
    }
  }
  function destroy() {
    for (const type of InputSystemType) {
      inputSystems[type].destroy();
    }
  }

  // TODO: これの関数名ビミョすぎ
  function createNewUiState(): NewUiState {
    return {
      nextBgColor: BACKGROUND_COLOR.nextColorMapIcon[clientPlaying.uiGroups.playArea.playarea.cssColor],
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
