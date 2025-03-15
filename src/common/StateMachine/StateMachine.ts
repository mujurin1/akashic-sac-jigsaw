// import { Keys, ObjectEntries } from "./types";

// export type StateMachine<
//   States extends readonly State[],
//   Transitions_ extends TransitionStateMap<States> = TransitionStateMap<States>,
// > = { readonly transitions: Transitions_; };

// type StateMachineBuilder<
//   States extends readonly State[],
//   Transitions_ extends TransitionStateMap<States> = TransitionStateMap<States>,
// > = {
//   build: () => StateMachine<States, Transitions_>;
// } & Builder_AddTransitions<States, Transitions_>;

// export const FSM = {
//   builder: <
//     StateMap extends { readonly [K in string]: any },
//     States extends readonly State[] = ObjectEntries<StateMap>,
//     Transitions extends TransitionStateMap<States> = TransitionStateMap<States>,
//   // >(stateNames: StatesToName<States>[]): StateMachineBuilder<States, Transitions> => {
//   // ↑なら同じ型での as してる部分が要らないがこれはタプルでないので↓で妥協
//   >(stateNames: Keys<States>): StateMachineBuilder<States, Transitions> => {

//     const transitions = {} as Transitions;
//     const builder = {
//       build: () => ({ transitions }),
//     } as StateMachineBuilder<States, Transitions>;

//     for (const currentState of stateNames as StatesToName<States>[]) {
//       type CurrentState = NamedState<States, typeof currentState>;
//       transitions[currentState] = {} as Transitions[StateToName<CurrentState>];
//       builder[currentState] = addTransition as StateMachineBuilder<States, Transitions>[StatesToName<States>];

//       function addTransition<AddTransitions extends Record<string, Transition<States, CurrentState>>>(
//         addTransitions: AddTransitions,
//       ) {
//         type AddTransitionName = keyof AddTransitions;
//         const newTransitions = transitions[currentState] as AddTransitions;
//         for (const [transitionName, fn] of Object.entries(addTransitions)) {
//           newTransitions[transitionName as AddTransitionName] = fn as any;
//         }
//         return builder;
//       }
//     }

//     return builder;
//   },
//   node: <
//     Machine extends StateMachine<readonly State[]>,
//     States extends StateMachineToState<Machine>,
//     Transitions extends Machine["transitions"],
//     const CurrentState extends States[number],
//   >(
//     machine: Machine,
//     firstState: CurrentState,
//     // ): StateMachineNode<States, Transitions, CurrentState> => {
//   ): StateMachineNode<States, Transitions, CurrentState> => {
//     let node = {
//       name: firstState[0],
//       data: firstState[1],
//     };

//     return {
//       node,
//       isState: ((stateName: any) => {
//         return node.name === stateName;
//       }) as any,
//       step: (name, ...args) => {
//         return null!;
//       },
//       test: null as any,
//     };
//   }
// } as const;


// export interface StateMachineNode<
//   States extends readonly State[],
//   Transitions extends TransitionStateMap<States>,
//   CurrentState extends States[number],
// > {
//   readonly data: CurrentState;
//   readonly node: StateToMap<CurrentState>;
//   // readonly node: CurrentState;

//   test: {
//     state: States,
//     transitions: Transitions,
//     currentState: CurrentState,
//     node: StateToMap<CurrentState>,
//     tName: TransitionStateMapToNames<Transitions, CurrentState>,
//   };

//   // 型ガード関数を追加
//   isState<S extends StateToName<CurrentState>>(stateName: S):
//     this is StateMachineNode<States, Transitions, NamedState<States, S>>;

//   step<
//     Name extends TransitionStateMapToNames<Transitions, CurrentState>,
//     T extends Transitions[StateToName<CurrentState>][Name] extends
//     Transition<States, CurrentState, any[]>
//     ? Transitions[StateToName<CurrentState>][Name]
//     : never,
//   >(
//     transitionName: Name,
//     ...args: TransitionToArgs<T>
//   ): StateMachineNode<States, Transitions, TransitionToNext<T>>;
// }


// /**
//  * `State[] => { [StateName]: {[transitionName]: (StateData) => State)} }`
//  */
// type Builder_AddTransitions<
//   States extends readonly State[],
//   Transitions extends TransitionStateMap<States> = TransitionStateMap<States>,
// > = {
//     [CurrentState in States[number]as StateToName<CurrentState>]:
//     Builder_AddTransition<States, CurrentState, Transitions>;
//   };

// type Builder_AddTransition<
//   States extends readonly State[],
//   CurrentState extends State = States[number],
//   Transitions extends TransitionStateMap<States> = TransitionStateMap<States>,
// > = <
//   Transitions_ extends {
//     readonly [K in string]: Transition<States, CurrentState>;
//   },
// >(transitions: Transitions_) => StateMachineBuilder<
//   States,
//   Transitions & { readonly [K in StateToName<CurrentState>]: Transitions_; }
// >;



// //#region BaseTypes
// /**
//  * `[StateName, StateData]`
//  */
// type State<
//   Name extends string = string,
//   Data extends any = any,
// > = readonly [Name, Data];

// /**
//  * `(data: <CurrentState>, ...args) => NextState`
//  */
// type Transition<
//   States extends readonly State[],
//   CurrentState extends State = States[number],
//   Args extends readonly any[] = readonly any[],
//   NextState extends State = States[number],
// > = (data: StateToData<CurrentState>, ...args: Args) => NextState;
// /**
//  * `{ [TransitionName]: Transition }`
//  */
// type TransitionMap<
//   States extends readonly State[],
//   Transitions extends Record<string, Transition<States, CurrentState>> = {},
//   CurrentState extends State = States[number],
// > = { readonly [K in keyof Transitions]: Transitions[K]; };

// /**
//  * `State[] => { [StateName]: {[transitionName]: (StateData) => State)} }`
//  */
// type TransitionStateMap<
//   States extends readonly State[],
//   Transitions extends { readonly [K in string]: Transition<States> } = {},
// > = {
//     readonly [CurrentState in States[number]as StateToName<CurrentState>]:
//     // TransitionMap<States, Transitions, CurrentState>;
//     { readonly [K in keyof Transitions]: Transitions[K]; };
//   };
// //#endregion BaseTypes


// //#region State Utility
// /**
//  * `[StateName, StateData] => StateName`
//  */
// type StateToName<T extends State> = T[0];
// /**
//  * `[StateName, StateData] => StateData`
//  */
// type StateToData<T extends State> = T[1];
// /**
//  * `[StateName, StateData][] => StateName[]`
//  */
// type StatesToName<T extends readonly State[]> = StateToName<T[number]>;
// /**
//  * `[StateName, StateData][] => StateData[]`
//  */
// type StatesToData<T extends readonly State[]> = StateToData<T[number]>;

// /**
//  * `[StateName, StateData][] => literal:{ name: StateName, data: StateData }`
//  */
// type StateToMap<T extends State> = {
//   readonly name: StateToName<T>;
//   readonly data: StateToData<T>;
// };
// /**
//  * `([StateName, StateData][], Name) => [Name, StateData]`
//  */
// type NamedState<
//   States extends readonly State[],
//   Name extends StatesToName<States> = StatesToName<States>,
// // > = readonly [
// //   Name,
// //   Extract<States[number], readonly [Name, any]>[1],
// // ];
// // > = (States[number] extends { readonly 0: Name; } ? States[number] : never);
// > = [...Extract<States[number], readonly [Name, any]>];
// // > = States[number] & readonly [Name, unknown];
// // > = readonly [...States[number] & [Name, unknown]];
// //#endregion State Utility


// //#region Transition Utility
// type TransitionStateMapToNames<
//   Transitions extends TransitionStateMap<readonly State[]>,
//   CurrentState extends TransitionStateMapToStates<Transitions>[number],
// > = keyof Transitions[StateToName<CurrentState>];
// type TransitionStateMapToStates<
//   Transitions extends TransitionStateMap<readonly State[]>
// > = Transitions extends TransitionStateMap<infer States> ? States : never;

// type TransitionToArgs<T extends Transition<readonly State[]>> =
//   T extends Transition<readonly State[], any, infer Args> ? Args : never;
// type TransitionToNext<T extends Transition<readonly State[]>> =
//   T extends Transition<readonly State[], any, any[], infer Next> ? Next : never;

// type TransitionStateMapToNamesAll<
//   Transitions extends TransitionStateMap<readonly State[]>,
// > = {
//   readonly [K in keyof Transitions]: keyof Transitions[K];
// }[keyof Transitions];
// //#endregion Transition Utility


// //#region StateMachine Utility
// type StateMachineToState<
//   Machine extends StateMachine<readonly State[], TransitionStateMap<readonly State[]>>,
// > = Machine extends StateMachine<infer States> ? States : never;
// type StateMachineSplit<
//   Machine extends StateMachine<readonly State[], TransitionStateMap<readonly State[]>>,
// > = Machine extends StateMachine<
//   infer States,
//   infer Transitions
// > ? readonly [States, Transitions] : never;
// //#endregion StateMachine Utility



// const fsm = (() => FSM.builder<{
//   // ノートとその状態を定義
//   standing: undefined,
//   running: { speed: number; },
//   slipping: { slipPower: number; },
// }>(["standing", "running", "slipping"])
//   // 状態ごとのイベント定義
//   .standing({
//     continue: (state) => ["standing", undefined],
//     run: (s, speed: number) => ["running", { speed }],
//     or: (s):
//       | ["standing", undefined]
//       | ["running", { speed: 0; }] => null!
//   })
//   .running({
//     continue: (state) => [
//       "running",
//       { speed: Math.max(100, state.speed + 10) },
//     ],
//     stopping: (state) => ["slipping", { slipPower: state.speed }],
//   })
//   .slipping({
//     step: (state) => {
//       const power = state.slipPower - 5;
//       if (power <= 0) return ["standing", undefined];
//       return ["slipping", { slipPower: power }];
//     },
//   })
//   .build()
// )();

// type FSM = typeof fsm;
// type TRANS = FSM["transitions"];
// type STATE = FSM["transitions"]["standing"];
// type STATE_NAME = FSM["transitions"]["standing"]["run"];

// const {
//   node: { name: wdqx, data },
//   step,
//   test: {
//     state,
//     transitions,
//     currentState,
//     tName,
//   },
// } = FSM.node(fsm, ["standing", undefined]);

// const next1 = step("run", 10);
// const next2 = next1.step("continue");
// const next3 = next2.step("stopping");
// const next4 = next3.step("step");
// next4.node.name;
// next4.node.data;
// next4.step("continue");
// const [a, b] = next4.test.currentState;

// // if (next4.isState("standing")) {
// // if (next4.node.name === "standing") {
// if (next4.isState("standing")) {
//   next4.node.name;
//   next4.node.data;
//   next4.test.transitions;
//   next4.step("run", 10);











//   const [a1, b1] = next4.data;  // Error
//   const [a2, b2] = next4.data;  // NoError
//   const [a3, b3] = next4.data;  // NoError

// } else if (next4.isState("slipping")) {
//   next4.node.name;
//   next4.node.data;
//   const [a, b] = next4.data;
//   next4.test.transitions;
//   next4.step("step");
// }


// if (next4.node.name !== "slipping") {
//   next4.node.name;
//   next4.node.data;
//   const [a, b] = next4.data;
//   next4.test.transitions;
//   next4.step("run", 10);
// }

// if (next4.data[0] !== "slipping") {
//   next4.node.name;
//   next4.node.data;
//   const [a, b] = next4.data;
//   next4.test.transitions;
//   next4.step("run", 10);
// }

// const { node: { name } } = next3.step("step");
// const x2 = next3.step2("step");


// type TS = TransitionStateMapToNames<
//   typeof transitions,
//   ["standing", undefined]
// >;
